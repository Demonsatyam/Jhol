from django.core.management.base import BaseCommand

from core.serp import credits_left, serp


class Command(BaseCommand):
    help = "Run one google search through the cache: manage.py probe '<query>' [--engine google]"

    def add_arguments(self, parser):
        parser.add_argument("query")
        parser.add_argument("--engine", default="google")

    def handle(self, query, engine, **_):
        data, source = serp(engine, q=query)
        for r in data.get("organic_results", data.get("news_results", []))[:5]:
            print("-", r.get("title"), r.get("link"))
        print(f"source={source} credits_left={credits_left(fresh=True)}")
