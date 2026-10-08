"""LLM jobs: extract entities, classify snippets, narrate. Gemini -> Groq -> heuristic. The LLM never scores."""
import hashlib
import json
import os
import re

from .score import registrable
from .serp import FIXTURES

ENTITY_KEYS = {"brand": "", "domains": [], "urls": [], "phones": [], "upi_ids": [], "app_names": [],
               "regulator_claims": [], "company": "", "address": "", "city": "", "scam_pattern": "",
               "image_urls": [], "language": "", "message_text": ""}
COMPLAINT_WORDS = ("scam", "fraud", "cheat", "complaint", "fake", "duped", "warning", "beware", "ठगी", "धोखा")


def _gemini(prompt, image=None, mime=None):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    parts = [prompt] + ([types.Part.from_bytes(data=image, mime_type=mime or "image/png")] if image else [])
    cfg = types.GenerateContentConfig(response_mime_type="application/json", temperature=0)
    try:
        r = client.models.generate_content(model=os.environ.get("GEMINI_MODEL", "gemini-flash-latest"),
                                           contents=parts, config=cfg)
    except Exception:  # noqa: BLE001 - 503 "high demand" is common; lite model is usually free
        r = client.models.generate_content(model="gemini-flash-lite-latest", contents=parts, config=cfg)
    return json.loads(r.text)


def _groq(prompt):
    from groq import Groq
    r = Groq(api_key=os.environ["GROQ_API_KEY"]).chat.completions.create(
        model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"), temperature=0,
        response_format={"type": "json_object"}, messages=[{"role": "user", "content": prompt}])
    return json.loads(r.choices[0].message.content)


def ask_json(prompt, image=None, mime=None):
    """Returns (dict, provider) or (None, 'fallback'). Answers are cached as fixtures by prompt hash so the same
    message always yields the same entities/queries (saves SerpApi credits, makes REPLAY deterministic)."""
    f = FIXTURES / "llm" / (hashlib.sha256(prompt.encode() + (image or b"")).hexdigest() + ".json")
    if f.exists():
        return json.loads(f.read_text()), "cache"
    data, provider = _ask_live(prompt, image, mime)
    if data is not None:
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(data, ensure_ascii=False))
    return data, provider


def _ask_live(prompt, image, mime):
    if os.environ.get("GEMINI_API_KEY"):
        try:
            return _gemini(prompt, image, mime), "gemini"
        except Exception as e:  # noqa: BLE001 - any provider failure falls through
            print(f"[llm] gemini failed: {str(e)[:200]}", flush=True)
    if os.environ.get("GROQ_API_KEY") and not image:
        try:
            return _groq(prompt), "groq"
        except Exception as e:  # noqa: BLE001
            print(f"[llm] groq failed: {str(e)[:200]}", flush=True)
    return None, "fallback"


# ---------- extract ----------

def regex_entities(text):
    t = text or ""
    urls = re.findall(r"https?://[^\s<>\"')]+", t)
    no_mail = re.sub(r"[\w.\-]+@[\w.\-]+", " ", t)  # don't read emails/UPI ids as domains
    bare = re.findall(r"\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s]*)?", no_mail.lower())
    domains = list(dict.fromkeys(registrable(u) for u in urls + bare))
    phones = [re.sub(r"[\s-]", "", p) for p in re.findall(r"(?<![\d+])(?:\+91[\s-]?)?[6-9]\d{4}\s?\d{5}\b", t)]
    upi = re.findall(r"\b[\w.\-]+@[a-z]+\b(?!\.)", t.lower())
    return {"urls": urls, "domains": domains, "phones": phones, "upi_ids": upi}


def extract(text, image=None, mime=None):
    prompt = (
        "You extract entities from a message an Indian user received (WhatsApp/SMS/email/screenshot). "
        "Return ONLY JSON with keys: brand (a famous real brand, bank or government body the message claims to "
        "represent, e.g. 'Amazon', 'SBI', 'Income Tax Department'; '' if the sender is just its own lesser-known "
        "company, which goes in company), domains (list of website domains in the message), urls, phones, upi_ids, app_names (apps it asks "
        "to install), regulator_claims (e.g. 'SEBI registered'), company (legal/company name stated), address, city, "
        "scam_pattern (short neutral phrase like 'task-based part-time job', 'stock tips telegram group', "
        "'KYC update'; '' if it reads like a routine transactional message), image_urls, language, "
        "message_text (the full message text; transcribe it if it is in the image).\n\nMESSAGE:\n" + (text or "(see image)"))
    data, provider = ask_json(prompt, image, mime)
    ents = {k: (data or {}).get(k) or type(v)() for k, v in ENTITY_KEYS.items()}
    for k, v in ENTITY_KEYS.items():  # LLMs sometimes return "x" for ["x"] or vice versa
        if isinstance(v, list) and isinstance(ents[k], str):
            ents[k] = [ents[k]]
        elif isinstance(v, str) and not isinstance(ents[k], str):
            ents[k] = ", ".join(map(str, ents[k])) if isinstance(ents[k], list) else str(ents[k])
    ents["message_text"] = ents["message_text"] or text or ""
    rx = regex_entities(ents["message_text"] + "\n" + (text or ""))
    for k in ("urls", "domains", "phones", "upi_ids"):  # always merge regex; LLMs miss URLs
        vals = ([registrable(d) for d in ents[k]] if k == "domains" else
                [re.sub(r"[\s-]", "", p) for p in ents[k]] if k == "phones" else ents[k])
        ents[k] = list(dict.fromkeys(v for v in vals + rx[k] if v))
    if not data:  # crude fallback for the rest
        low = ents["message_text"].lower()
        ents["regulator_claims"] = [m.group(0) for m in re.finditer(r"(sebi|rbi)[ -]?(registered|approved)", low)]
        ents["scam_pattern"] = ("part-time job" if "job" in low or "task" in low else
                                "investment tips" if "invest" in low or "stock" in low else
                                "KYC update" if "kyc" in low else "")
    ents["_provider"] = provider
    return ents


# ---------- classify ----------

def classify(items):
    """items: [{evidence_id, link_index, target, title, snippet}] -> same list with 'label'."""
    if not items:
        return items
    lines = "\n".join(f"{i}. [{x['evidence_id']}#{x['link_index']}] target={x['target']!r} | {x['title']} | {x['snippet']}"
                      for i, x in enumerate(items))
    prompt = ("Label each search result about the given target. 'complaint' = a fraud report, scam warning, "
              "victim complaint, or regulator action/caution against the target. 'official' = the target's own "
              "site or a registration/listing record. 'neutral' = anything else, including results not about the "
              "target. Return JSON {\"labels\": [{\"i\": <index>, \"label\": \"complaint|neutral|official\"}]}.\n\n" + lines)
    data, _ = ask_json(prompt)
    got = {}
    for row in (data or {}).get("labels", []):
        if isinstance(row, dict) and row.get("label") in ("complaint", "neutral", "official"):
            got[row.get("i")] = row["label"]
    for i, x in enumerate(items):
        text = f"{x['title']} {x['snippet']}".lower()
        x["label"] = got.get(i) or ("complaint" if any(w in text for w in COMPLAINT_WORDS) else "neutral")
    return items


# ---------- narrate ----------

def guard_citations(text, valid_ids):
    """Strip any [E#] the model invented; split lists like [E3, E7] into [E3][E7]."""
    def keep(m):
        return "".join(f"[{i}]" for i in re.findall(r"E\d+", m.group(0)) if i in valid_ids)
    return re.sub(r"\[E\d+(?:\s*,\s*E\d+)*\]", keep, text or "").replace("  ", " ")


def _fallback_narrative(signals, score, band):
    if not signals:
        return f"No strong risk indicators were found (score {score}/100). Stay careful with links and OTPs."
    parts = [f"{s['detail']} {''.join(f'[{i}]' for i in s['evidence_ids'])}" for s in signals]
    return f"Risk indicators found (score {score}/100, {band.replace('_', ' ')}): " + "; ".join(parts) + "."


def _fallback_warning(band):
    if band == "low":
        return ("Jhol check: few risk indicators found in this message. Still, never share OTP/PIN.\n"
                "जांच: इस संदेश में कम जोखिम संकेत मिले। फिर भी OTP/PIN कभी शेयर न करें।")
    return ("⚠️ Jhol check: this message shows multiple scam risk indicators. Don't click links, pay, or share OTP.\n"
            "⚠️ सावधान: इस संदेश में धोखाधड़ी के कई संकेत हैं। लिंक न खोलें, पैसे न भेजें, OTP शेयर न करें।")


def narrate(signals, evidence, score, band):
    valid = {e["id"] for e in evidence}
    summary = "\n".join(f"[{e['id']}] {e['probe']} ({e['engine']}) q={e['query']!r} facts={json.dumps(e['facts'])[:300]} "
                        f"top={[l['title'] for l in e['links'][:3]]}" for e in evidence)
    sigs = "\n".join(f"{s['code']} {s['weight']:+d} {s['evidence_ids']}: {s['detail']}" for s in signals) or "(none)"
    prompt = (f"Risk score {score}/100, band {band}. Signals:\n{sigs}\n\nEvidence:\n{summary}\n\n"
              "Write JSON {\"explanation\": ..., \"warning\": ...}. explanation: 3-5 plain English sentences for "
              "a non-technical Indian user; every factual claim must cite evidence ids like [E2]; only use ids "
              "listed above. Say 'risk indicators found', never call anyone a fraud. warning: a short message to "
              "forward to a family WhatsApp group, Hindi line then English line, no citations.")
    data, _ = ask_json(prompt)
    text = guard_citations((data or {}).get("explanation"), valid) or _fallback_narrative(signals, score, band)
    return text, (data or {}).get("warning") or _fallback_warning(band)
