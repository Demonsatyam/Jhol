import json
import time

from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import Investigation
from .probes import investigate as run
from .serp import credits_left

_credits = (0.0, None)


@csrf_exempt
@require_POST
def investigate(request):
    text = request.POST.get("text") or (request.FILES["text"].read().decode() if "text" in request.FILES else "")
    text = text.strip()[:5000]
    f = request.FILES.get("image")
    image, mime = (f.read(), f.content_type) if f else (None, None)
    if not text and not image:
        return JsonResponse({"error": "Paste a message or add a screenshot."}, status=400)

    def stream():
        try:
            for ev in run(text, image, mime):
                if ev["type"] == "_result":  # save in this (request) thread, never in probe workers
                    inv = Investigation.objects.create(
                        input_text=text or ev["entities"].get("message_text", ""), entities=ev["entities"],
                        evidence=ev["evidence"], signals=ev["signals"], score=ev["score"], band=ev["band"],
                        narrative=ev["narrative"], warning_text=ev["warning"])
                    ev = {"type": "done", "id": str(inv.id)}
                yield json.dumps(ev, ensure_ascii=False) + "\n"
        except Exception as e:  # noqa: BLE001 - surface to the UI instead of a dead stream
            yield json.dumps({"type": "error", "message": str(e)[:300]}) + "\n"

    resp = StreamingHttpResponse(stream(), content_type="application/x-ndjson")
    resp["X-Accel-Buffering"] = "no"
    resp["Cache-Control"] = "no-cache"
    return resp


@require_GET
def report(request, pk):
    inv = get_object_or_404(Investigation, pk=pk)
    return JsonResponse({k: getattr(inv, k) for k in ("input_text", "entities", "evidence", "signals", "score",
                                                     "band", "narrative", "warning_text")} |
                        {"id": str(inv.id), "created_at": inv.created_at.isoformat()})


@require_GET
def credits(request):
    global _credits
    if time.time() - _credits[0] > 30:
        _credits = (time.time(), credits_left())
    return JsonResponse({"left": _credits[1]})
