import json
from pathlib import Path

from django.core.management.base import BaseCommand

from core.probes import investigate


class Command(BaseCommand):
    help = "Investigate a message file and print the event stream: manage.py investigate examples/task_scam.txt"

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument("--image")

    def handle(self, path, image, **_):
        text = Path(path).read_text() if path != "-" else ""
        img = Path(image).read_bytes() if image else None
        mime = "image/jpeg" if image and image.lower().endswith((".jpg", ".jpeg")) else "image/png"
        for ev in investigate(text, img, mime):
            if ev["type"] == "_result":
                continue
            if ev["type"] == "probe_done":
                e = ev["evidence"]
                print(f"  ✓ {e['id']} {e['probe']:<16} {e['source']:<6} {e['latency_ms']:>6}ms {json.dumps(e['facts'], ensure_ascii=False)[:160]}")
            elif ev["type"] == "labels":
                for e in ev["evidence"]:
                    for l in e["links"]:
                        if "label" in l:
                            print(f"    {e['id']} [{l['label']}] {l['title'][:90]}")
            else:
                print(json.dumps(ev, ensure_ascii=False)[:400])
