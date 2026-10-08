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


def serp(engine, _upload=None, **params):
    """Returns (data, source) where source is live | cache | replay.
    _upload=(bytes, mime) uploads an image for google_lens; cached by the image's sha256."""
    if engine in GL_HL:
        params = {"gl": "in", "hl": "en", **params}
    elif engine == "google_lens":
        params = {"hl": "en", "country": "in", **params}
    key = cache_key(engine, {**params, "image_sha256": hashlib.sha256(_upload[0]).hexdigest()} if _upload else params)

    if os.environ.get("REPLAY") == "1":
        f = FIXTURES / f"{key}.json"
        if not f.exists():
            raise ReplayMiss(f"no fixture for {engine} {params}")
        return json.loads(f.read_text()), "replay"

    api_key = os.environ.get("SERPAPI_KEY", "")
    hit = SerpCache.objects.filter(key=key).first()
    if hit and "_pending_sid" not in hit.response:
        return hit.response, "cache"
    if hit:  # an earlier search stalled at SerpApi: pick it up from the free archive instead of paying again
        return _finish(key, engine, params, hit.response["_pending_sid"], {}, api_key, "cache")

    left = credits_left()
    if left is not None and left < 40 and os.environ.get("ALLOW_LIVE") != "1":
        raise BudgetExceeded(f"only {left} SerpApi credits left; set ALLOW_LIVE=1 to override")

    # Async submit + poll the (free) archive: a blocking GET that times out still costs a credit,
    # and SerpApi sometimes takes 60-90s per search.
    if _upload:
        if len(_upload[0]) > 500_000:
            raise ValueError("screenshot is over SerpApi's 500 KB upload limit; Lens skipped")
        up = httpx.post("https://serpapi.com/image", params={"api_key": api_key},
                        files={"image": ("upload", _upload[0], _upload[1] or "image/png")}, timeout=30).json()
        if not up.get("image_id"):
            raise RuntimeError(f"image upload failed: {scrub(up)}")
        params = {**params, "image_id": up["image_id"]}  # expires in 10 min, so never part of the cache key
    data = httpx.get("https://serpapi.com/search.json",
                     params={"engine": engine, **params, "async": "true", "api_key": api_key}, timeout=30).json()
    global live_calls, _credits
    with _lock:
        live_calls += 1
        n = live_calls
        _credits = (0.0, _credits[1])  # force refresh next time
    print(f"[serp] LIVE {engine} {params}. live calls this process: {n}", flush=True)
    return _finish(key, engine, params, data.get("search_metadata", {}).get("id"), data, api_key, "live")


def _finish(key, engine, params, sid, data, api_key, source):
    status = lambda: data.get("search_metadata", {}).get("status")  # noqa: E731
    deadline = time.time() + 90
    while sid and status() in (None, "Processing", "Queued") and time.time() < deadline:
        time.sleep(2 if data else 0)
        data = httpx.get(f"https://serpapi.com/searches/{sid}.json", params={"api_key": api_key}, timeout=20).json()
    data = scrub(data)
    if sid and status() in ("Processing", "Queued"):
        SerpCache.objects.update_or_create(key=key, defaults={"engine": engine, "params": params,
                                                              "response": {"_pending_sid": sid}})
        raise TimeoutError("SerpApi still processing; will resume from archive next time")
    # "no results" comes back as status=Success with an error string: that's real evidence, keep it
    if status() != "Success":
        SerpCache.objects.filter(key=key).delete()
        raise RuntimeError(data.get("error") or f"SerpApi status {status()}")

    SerpCache.objects.update_or_create(key=key, defaults={"engine": engine, "params": params, "response": data})
    FIXTURES.mkdir(exist_ok=True)
    (FIXTURES / f"{key}.json").write_text(json.dumps(data, ensure_ascii=False))
    return data, source
