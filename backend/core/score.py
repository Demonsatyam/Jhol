"""Deterministic risk scoring. Pure functions over entities + evidence. No LLM here."""
import re

WEIGHTS = {
    "IMPERSONATION": 30,
    "COMPLAINTS_FOUND": 25,
    "REGULATOR_CLAIM_UNVERIFIED": 20,
    "STOLEN_OR_STOCK_IMAGE": 20,
    "ZERO_FOOTPRINT": 15,
    "PATTERN_IN_NEWS": 15,
    "APP_RED_FLAGS": 15,
    "GHOST_OFFICE": 10,
    "OFFICIAL_DOMAIN_MATCH": -20,
    "REGULATOR_VERIFIED": -15,
    "ESTABLISHED_PLACE": -10,
}
BANDS = [(30, "low"), (60, "caution"), (100, "likely_scam")]
STOCK_SITES = ("shutterstock", "istockphoto", "gettyimages", "freepik", "dreamstime", "123rf", "alamy",
               "depositphotos", "pexels", "unsplash", "pixabay", "adobe.com", "vecteezy")
# ponytail: tiny public-suffix list, swap for tldextract if odd TLDs show up
MULTI_SUFFIX = ("co.in", "bank.in", "gov.in", "org.in", "net.in", "ac.in", "edu.in", "nic.in", "firm.in",
                "gen.in", "ind.in", "res.in", "co.uk", "com.au")


def registrable(host):
    host = re.sub(r"^https?://", "", (host or "").lower()).split("/")[0].split(":")[0].removeprefix("www.")
    parts = host.split(".")
    n = 3 if ".".join(parts[-2:]) in MULTI_SUFFIX else 2
    return ".".join(parts[-n:])


def same_org(domain, official):
    domain, official = registrable(domain), registrable(official)
    return bool(official) and (domain == official or domain.endswith("." + official))


def parse_installs(s):
    digits = re.sub(r"[^\d]", "", str(s or ""))
    return int(digits) if digits else 0


def mentions(link, target):
    """Deterministic relevance check: Google drops unknown quoted terms, so make sure the result names the target."""
    t = (target or "").lower()
    hay = f"{link.get('title', '')} {link.get('snippet', '')} {link.get('url', '')}".lower()
    digits = re.sub(r"\D", "", t)
    if len(digits) >= 10:
        return digits[-10:] in re.sub(r"\D", "", hay)
    return bool(t) and (t in hay or t.split(".")[0] in hay.replace(" ", "-"))


def _ok(evidence, probe):
    return [e for e in evidence if e["probe"] == probe and not e["facts"].get("inconclusive")]


def _sig(code, ids, detail):
    return {"code": code, "weight": WEIGHTS[code], "evidence_ids": ids, "detail": detail}


def compute_signals(entities, evidence):
    out = []
    domains = [registrable(d) for d in entities.get("domains", [])]
    brand = (entities.get("brand") or "").strip()

    off = next((e for e in _ok(evidence, "official_domain") if e["facts"].get("official_domain")), None)
    if off and domains:
        official = off["facts"]["official_domain"]
        fakes = [d for d in domains if not same_org(d, official)]
        if brand and fakes:
            out.append(_sig("IMPERSONATION", [off["id"]],
                            f"{', '.join(fakes)} is not {brand}'s official site ({official})"))
        elif not fakes:
            out.append(_sig("OFFICIAL_DOMAIN_MATCH", [off["id"]], f"All links point to {official}"))

    complaints = [(e, l) for e in _ok(evidence, "complaints") for l in e["links"]
                  if l.get("label") == "complaint" and mentions(l, e["facts"].get("target"))]
    if len(complaints) >= 2:
        ids = sorted({e["id"] for e, _ in complaints})
        out.append(_sig("COMPLAINTS_FOUND", ids,
                        f"{len(complaints)} complaint/fraud reports mention {complaints[0][0]['facts'].get('target')}"))

    for e in _ok(evidence, "regulator"):
        verified = [l for l in e["links"] if l.get("label") != "complaint" and mentions(l, e["facts"].get("target"))]
        if verified:
            out.append(_sig("REGULATOR_VERIFIED", [e["id"]], f"{len(verified)} matching page(s) on SEBI/RBI"))
        elif entities.get("regulator_claims"):
            out.append(_sig("REGULATOR_CLAIM_UNVERIFIED", [e["id"]],
                            f"Claims '{entities['regulator_claims'][0]}' but no registration found on SEBI/RBI"))

    for e in _ok(evidence, "lens"):
        f = e["facts"]
        if f.get("stock_hits") or len(f.get("domains", [])) >= 3:
            out.append(_sig("STOLEN_OR_STOCK_IMAGE", [e["id"]],
                            f"Image appears on {len(f.get('domains', []))} other sites"
                            + (f", incl. stock sites" if f.get("stock_hits") else "")))
            break

    for e in _ok(evidence, "domain_footprint"):
        if e["facts"].get("indexed") == 0:
            out.append(_sig("ZERO_FOOTPRINT", [e["id"]], f"{e['facts']['domain']} has no pages indexed by Google"))
            break

    news = _ok(evidence, "news_pattern")
    if news and len(news[0]["links"]) >= 2:
        out.append(_sig("PATTERN_IN_NEWS", [news[0]["id"]],
                        f"{news[0]['facts'].get('articles', len(news[0]['links']))} news reports on '{entities.get('scam_pattern')}' scams"))

    for e in _ok(evidence, "play_app"):
        f = e["facts"]
        dev = (f.get("developer") or "").lower()
        why = ("not found on Google Play" if not f.get("found")
               else f"only {f.get('installs')} installs" if parse_installs(f.get("installs")) < 10_000
               else f"developer '{f.get('developer')}' doesn't match {brand}" if brand and brand.lower() not in dev
               else None)
        if why:
            out.append(_sig("APP_RED_FLAGS", [e["id"]], f"App '{f.get('app')}': {why}"))
            break

    for e in _ok(evidence, "maps_office"):
        f = e["facts"]
        if entities.get("address") and not f.get("found"):
            out.append(_sig("GHOST_OFFICE", [e["id"]], f"No business found on Google Maps at '{entities['address']}'"))
        elif f.get("found") and (f.get("reviews") or 0) >= 50:
            out.append(_sig("ESTABLISHED_PLACE", [e["id"]], f"{f.get('title')} on Maps with {f['reviews']} reviews"))
    return out


def score(signals):
    s = max(0, min(100, sum(x["weight"] for x in signals)))
    return s, next(b for hi, b in BANDS if s <= hi)
