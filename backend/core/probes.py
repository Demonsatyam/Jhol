"""Probes (one SerpApi query each) + the investigation orchestrator that streams events."""
import re
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

from django.db import connection

from . import llm
from .score import STOCK_SITES, compute_signals, registrable, same_org, score
from .serp import credits_left, serp

NOT_OFFICIAL = ("facebook.com", "wikipedia.org", "linkedin.com", "x.com", "twitter.com", "instagram.com",
                "youtube.com", "quora.com", "reddit.com", "justdial.com", "glassdoor.co.in", "glassdoor.com",
                "ambitionbox.com", "google.com", "indeed.com", "naukri.com", "zaubacorp.com", "tofler.in")
GENERIC = {"pvt", "ltd", "private", "limited", "the", "and", "india", "services", "solutions", "capital",
           "advisors", "advisory", "group", "company", "co", "llp", "inc", "technologies", "wealth", "office"}
INVEST = ("invest", "stock", "trading", "share", "ipo", "crypto", "loan", "fund", "returns", "tips")


def _links(results, n=5):
    return [{"title": r.get("title", ""), "url": r.get("link", ""), "snippet": r.get("snippet", "")}
            for r in results if r.get("link")][:n]


def _tokens(s):
    return {w for w in re.findall(r"[a-z0-9]+", (s or "").lower()) if w not in GENERIC and len(w) > 2}


# ---------- probe specs: {probe, engine, params, query, parse(data) -> (links, facts)} ----------

def official_domain(brand):
    def parse(d):
        org = d.get("organic_results", [])
        top = next((r for r in org if registrable(r.get("link")) not in NOT_OFFICIAL), None)
        return _links(org, 3), {"brand": brand, "official_domain": registrable(top["link"]) if top else None}
    q = f'"{brand}" official website'
    return {"probe": "official_domain", "engine": "google", "query": q, "params": {"q": q}, "parse": parse}


def domain_footprint(domain):
    q = f"site:{domain}"
    return {"probe": "domain_footprint", "engine": "google", "query": q, "params": {"q": q},
            "parse": lambda d: (_links(d.get("organic_results", []), 3),
                                {"domain": domain, "indexed": len(d.get("organic_results", []))})}


def complaints(target):
    q = f'"{target}" scam OR fraud OR complaint'
    return {"probe": "complaints", "engine": "google", "query": q, "params": {"q": q},
            "parse": lambda d: (_links(d.get("organic_results", []), 8), {"target": target})}


def regulator(name):
    q = f'"{name}" site:sebi.gov.in OR site:rbi.gov.in'
    return {"probe": "regulator", "engine": "google", "query": q, "params": {"q": q},
            "parse": lambda d: (_links(d.get("organic_results", []), 5),
                                {"target": name, "hits": len(d.get("organic_results", []))})}


def news_pattern(pattern, brand):
    q = f"{brand} {pattern} scam".strip()

    def parse(d):
        flat = []
        for r in d.get("news_results", []):
            flat += r.get("stories", [r]) if not r.get("link") else [r]
        links = [{"title": r.get("title", ""), "url": r["link"],
                  "snippet": f"{(r.get('source') or {}).get('name', '')} · {r.get('date', '')}".strip(" ·")}
                 for r in flat if r.get("link")][:6]
        return links, {"pattern": pattern, "articles": len(flat)}
    return {"probe": "news_pattern", "engine": "google_news", "query": q, "params": {"q": q}, "parse": parse}


def lens(image_url=None, upload=None):
    def parse(d):
        matches = d.get("exact_matches", []) + d.get("visual_matches", [])
        domains = sorted({registrable(m.get("link")) for m in matches if m.get("link")})
        stock = [x for x in domains if any(s in x for s in STOCK_SITES)]
        return (_links([{**m, "snippet": m.get("source", "")} for m in matches], 5),
                {"match_count": len(matches), "domains": domains[:20], "stock_hits": stock})
    params = {"url": image_url} if image_url else {}
    return {"probe": "lens", "engine": "google_lens", "query": image_url or "(uploaded screenshot)",
            "params": params, "upload": upload, "parse": parse}


def play_app(app, brand):
    def parse(d):
        items = [i for r in d.get("organic_results", []) for i in r.get("items", [])]
        hit = next((i for i in items if _tokens(app) <= _tokens(i.get("title"))), None)
        links = [{"title": i.get("title", ""), "url": i.get("link", ""),
                  "snippet": f"{i.get('author', '')} · {i.get('downloads', '?')} installs"} for i in items[:3]]
        if not hit:
            return links, {"app": app, "found": False}
        return links, {"app": app, "found": True, "title": hit.get("title"), "developer": hit.get("author"),
                       "installs": hit.get("downloads"), "rating": hit.get("rating")}
    return {"probe": "play_app", "engine": "google_play", "query": app,
            "params": {"q": app, "store": "apps"}, "parse": parse}


def maps_office(company, where):
    q = f"{company} {where}".strip()

    def parse(d):
        places = [d["place_results"]] if d.get("place_results") else d.get("local_results", [])
        hit = next((p for p in places if _tokens(company) & _tokens(p.get("title"))), None)
        links = [{"title": p.get("title", ""), "url": p.get("website") or p.get("links", {}).get("website", "")
                  or f"https://www.google.com/maps/search/{p.get('title', '')}",
                  "snippet": f"{p.get('address', '')} · ★{p.get('rating', '-')} ({p.get('reviews', 0)})"} for p in places[:3]]
        if not hit:
            return links, {"found": False, "query": q}
        return links, {"found": True, "title": hit.get("title"), "rating": hit.get("rating"),
                       "reviews": hit.get("reviews") or 0, "address": hit.get("address")}
    return {"probe": "maps_office", "engine": "google_maps", "query": q,
            "params": {"q": q, "type": "search"}, "parse": parse}


def run_probe(eid, spec):
    t = time.time()
    links, facts, source = [], {}, "error"
    try:
        data, source = serp(spec["engine"], _upload=spec.get("upload"), **spec["params"])
        links, facts = spec["parse"](data)
    except Exception as e:  # noqa: BLE001 - a failed probe is inconclusive, never adds risk
        facts = {"inconclusive": True, "error": str(e)[:200]}
    finally:
        connection.close()  # worker threads get their own DB connection; don't leak it
    return {"id": eid, "probe": spec["probe"], "engine": spec["engine"], "query": spec["query"], "source": source,
            "latency_ms": int((time.time() - t) * 1000), "links": links, "facts": facts,
            "followup": spec.get("followup", False)}


# ---------- orchestrator ----------

def investigate(text, image=None, mime=None):
    """Generator of event dicts. Runs in the caller's thread; only probes run in workers."""
    ents = llm.extract(text, image, mime)
    yield {"type": "entities", "entities": ents}

    brand, company = ents["brand"], ents["company"]
    domains = ents["domains"][:2]
    pattern = ents["scam_pattern"]
    specs = []
    if brand:
        specs.append(official_domain(brand))
    specs += [domain_footprint(d) for d in domains]
    # complaints: look-alike domain (decided after official_domain), else phone/UPI/company
    other = next(iter(ents["phones"] + ents["upi_ids"]), None) or (company if company and not brand else None)
    if domains and not brand:
        specs.append(complaints(domains[0]))
    elif other and not domains:
        specs.append(complaints(other))
    if (ents["regulator_claims"] or any(w in pattern.lower() for w in INVEST)) and (company or brand):
        specs.append(regulator(company or brand))
    if pattern:
        specs.append(news_pattern(pattern, brand))
    if image:
        specs.append(lens(upload=(image, mime)))
    elif ents["image_urls"]:
        specs.append(lens(image_url=ents["image_urls"][0]))
    if ents["app_names"]:
        specs.append(play_app(ents["app_names"][0], brand))
    if (ents["address"] or ents["city"]) and (company or brand):
        specs.append(maps_office(company or brand, ents["address"] or ents["city"]))

    evidence, seen, pending = [], set(), {}
    pool = ThreadPoolExecutor(max_workers=8)

    def submit(spec):
        if (spec["engine"], spec["query"]) in seen:
            return None
        seen.add((spec["engine"], spec["query"]))
        eid = f"E{len(seen)}"
        pending[pool.submit(run_probe, eid, spec)] = eid
        return {"type": "probe_start", "id": eid, "probe": spec["probe"], "engine": spec["engine"],
                "query": spec["query"], "followup": spec.get("followup", False)}

    try:
        for s in specs:
            if ev := submit(s):
                yield ev
        while pending:
            done, _ = wait(pending, return_when=FIRST_COMPLETED)
            for fut in done:
                del pending[fut]
                e = fut.result()
                evidence.append(e)
                yield {"type": "probe_done", "evidence": e}
                if e["probe"] != "official_domain" or not domains:
                    continue
                official = e["facts"].get("official_domain")
                lookalikes = [d for d in domains if not official or not same_org(d, official)]
                if lookalikes:
                    reason = (f"{lookalikes[0]} is not {brand}'s official domain ({official}): checking impersonation"
                              if official else f"Couldn't confirm {brand}'s official site: checking {lookalikes[0]}")
                    yield {"type": "followup", "reason": reason}
                    for s in (domain_footprint(lookalikes[0]), complaints(lookalikes[0])):
                        if ev := submit({**s, "followup": True}):
                            yield ev
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    # one batched classification call over complaint + regulator snippets
    items = [{"evidence_id": e["id"], "link_index": i, "target": e["facts"].get("target", ""),
              "title": l["title"], "snippet": l["snippet"]}
             for e in evidence if e["probe"] in ("complaints", "regulator") for i, l in enumerate(e["links"])]
    by_id = {e["id"]: e for e in evidence}
    for x in llm.classify(items):
        by_id[x["evidence_id"]]["links"][x["link_index"]]["label"] = x["label"]
    evidence.sort(key=lambda e: int(e["id"][1:]))
    yield {"type": "labels", "evidence": evidence}

    signals = compute_signals(ents, evidence)
    for s in signals:
        yield {"type": "signal", **s}
    sc, band = score(signals)
    yield {"type": "score", "score": sc, "band": band}
    text_out, warning = llm.narrate(signals, evidence, sc, band)
    yield {"type": "narrative", "text": text_out, "warning": warning}
    yield {"type": "credits", "left": credits_left()}
    yield {"type": "_result", "entities": ents, "evidence": evidence, "signals": signals, "score": sc, "band": band,
           "narrative": text_out, "warning": warning}
