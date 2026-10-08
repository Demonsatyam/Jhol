"""The only way Jhol talks to SerpApi: REPLAY fixtures -> Postgres cache -> live call (logged, budgeted)."""
import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

import httpx

from .models import SerpCache

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
# engines that accept gl/hl; google_lens uses hl + country instead
GL_HL = {"google", "google_news", "google_play", "google_maps"}
_lock = threading.Lock()
live_calls = 0
_credits = (0.0, None)  # (fetched_at, value)


class ReplayMiss(Exception):
    pass


class BudgetExceeded(Exception):
    pass


def cache_key(engine, params):
    return hashlib.sha256(json.dumps({"engine": engine, **params}, sort_keys=True).encode()).hexdigest()


def scrub(obj):
    """Remove anything that looks like an api key before it touches disk."""
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items() if k != "api_key"}
    if isinstance(obj, list):
        return [scrub(v) for v in obj]
    if isinstance(obj, str):
        return re.sub(r"api_key=[^&\"'\s]*&?", "", obj)
    return obj


def credits_left(fresh=False):
    """Account endpoint is free. Cached 30s in memory."""
    global _credits
    if os.environ.get("REPLAY") == "1" or not os.environ.get("SERPAPI_KEY"):
        return None
    if fresh or time.time() - _credits[0] > 30:
        try:
            r = httpx.get("https://serpapi.com/account.json", params={"api_key": os.environ["SERPAPI_KEY"]}, timeout=10)
            _credits = (time.time(), r.json().get("total_searches_left"))
        except httpx.HTTPError:
            return _credits[1]
    return _credits[1]


def serp(engine, **params):
    """Returns (data, source) where source is live | cache | replay."""
    if engine in GL_HL:
        params = {"gl": "in", "hl": "en", **params}
    elif engine == "google_lens":
        params = {"hl": "en", "country": "in", **params}
    key = cache_key(engine, params)

    if os.environ.get("REPLAY") == "1":
        f = FIXTURES / f"{key}.json"
        if not f.exists():
            raise ReplayMiss(f"no fixture for {engine} {params}")
        return json.loads(f.read_text()), "replay"

    hit = SerpCache.objects.filter(key=key).first()
    if hit:
        return hit.response, "cache"

    left = credits_left()
    if left is not None and left < 40 and os.environ.get("ALLOW_LIVE") != "1":
        raise BudgetExceeded(f"only {left} SerpApi credits left; set ALLOW_LIVE=1 to override")

    # Async submit + poll the (free) archive: a blocking GET that times out still costs a credit,
    # and SerpApi sometimes takes 60-90s per search.
    api_key = os.environ["SERPAPI_KEY"]
    data = httpx.get("https://serpapi.com/search.json",
                     params={"engine": engine, **params, "async": "true", "api_key": api_key}, timeout=30).json()
    global live_calls, _credits
    with _lock:
        live_calls += 1
        n = live_calls
        _credits = (0.0, _credits[1])  # force refresh next time
    print(f"[serp] LIVE {engine} {params}. live calls this process: {n}", flush=True)
    sid = data.get("search_metadata", {}).get("id")
    deadline = time.time() + 150
    while sid and data["search_metadata"].get("status") in ("Processing", "Queued") and time.time() < deadline:
        time.sleep(2)
        data = httpx.get(f"https://serpapi.com/searches/{sid}.json", params={"api_key": api_key}, timeout=20).json()
    data = scrub(data)
    # "no results" comes back as status=Success with an error string: that's real evidence, keep it
    if data.get("search_metadata", {}).get("status") != "Success":
        raise RuntimeError(data.get("error", f"HTTP {r.status_code}"))

    SerpCache.objects.update_or_create(key=key, defaults={"engine": engine, "params": params, "response": data})
    FIXTURES.mkdir(exist_ok=True)
    (FIXTURES / f"{key}.json").write_text(json.dumps(data, ensure_ascii=False))
    return data, "live"
