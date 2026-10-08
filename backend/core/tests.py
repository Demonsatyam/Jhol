from django.test import SimpleTestCase

from .llm import guard_citations, regex_entities
from .score import compute_signals, registrable, same_org, score


def ev(id, probe, facts=None, links=None):
    return {"id": id, "probe": probe, "engine": "google", "query": "", "facts": facts or {}, "links": links or []}


COMPLAINT = {"title": "x", "url": "u", "snippet": "", "label": "complaint"}


class ScoreTests(SimpleTestCase):
    def test_scam_like_is_likely_scam(self):
        ents = {"brand": "Amazon", "domains": ["amazon-task-jobs.xyz"], "regulator_claims": [], "scam_pattern": "task job"}
        evidence = [
            ev("E1", "official_domain", {"official_domain": "amazon.in"}),
            ev("E2", "domain_footprint", {"domain": "amazon-task-jobs.xyz", "indexed": 0}),
            ev("E3", "complaints", {"target": "amazon-task-jobs.xyz"}, [COMPLAINT, COMPLAINT]),
            ev("E4", "news_pattern", {}, [{}, {}, {}]),
        ]
        sigs = compute_signals(ents, evidence)
        self.assertEqual({s["code"] for s in sigs}, {"IMPERSONATION", "ZERO_FOOTPRINT", "COMPLAINTS_FOUND", "PATTERN_IN_NEWS"})
        self.assertEqual(score(sigs), (85, "likely_scam"))
        self.assertTrue(all(s["evidence_ids"] for s in sigs))

    def test_official_and_regulator_verified_is_low(self):
        ents = {"brand": "SBI", "domains": ["onlinesbi.sbi.bank.in"], "regulator_claims": ["RBI regulated"]}
        evidence = [ev("E1", "official_domain", {"official_domain": "sbi.bank.in"}),
                    ev("E2", "regulator", {"hits": 1}, [{"title": "SBI", "label": "official"}])]
        sigs = compute_signals(ents, evidence)
        self.assertEqual({s["code"] for s in sigs}, {"OFFICIAL_DOMAIN_MATCH", "REGULATOR_VERIFIED"})
        self.assertEqual(score(sigs), (0, "low"))

    def test_inconclusive_adds_nothing(self):
        ents = {"brand": "Amazon", "domains": ["evil.xyz"], "regulator_claims": ["SEBI registered"], "address": "MG Road"}
        evidence = [ev(f"E{i}", p, {"inconclusive": True}) for i, p in enumerate(
            ["official_domain", "domain_footprint", "complaints", "regulator", "news_pattern", "lens", "play_app", "maps_office"])]
        self.assertEqual(compute_signals(ents, evidence), [])

    def test_regulator_enforcement_page_is_not_verification(self):
        ents = {"regulator_claims": ["SEBI registered"]}
        sigs = compute_signals(ents, [ev("E1", "regulator", {}, [{"title": "SEBI order", "label": "complaint"}])])
        self.assertEqual([s["code"] for s in sigs], ["REGULATOR_CLAIM_UNVERIFIED"])

    def test_bands(self):
        self.assertEqual(score([{"weight": 30}]), (30, "low"))
        self.assertEqual(score([{"weight": 31}]), (31, "caution"))
        self.assertEqual(score([{"weight": 61}, {"weight": 99}]), (100, "likely_scam"))


class HelperTests(SimpleTestCase):
    def test_citation_guard_strips_fake_ids(self):
        self.assertEqual(guard_citations("Bad site [E1][E9]. Ok [E2].", {"E1", "E2"}), "Bad site [E1]. Ok [E2].")

    def test_domains(self):
        self.assertEqual(registrable("https://www.onlinesbi.sbi.bank.in/x"), "sbi.bank.in")
        self.assertTrue(same_org("jobs.amazon.in", "amazon.in"))
        self.assertFalse(same_org("amazon-in.co", "amazon.in"))

    def test_regex(self):
        r = regex_entities("Join https://earn-daily.top/r?x=1 call +91 98765 43210 pay task.pay@ybl or mail a@gmail.com")
        self.assertEqual(r["domains"], ["earn-daily.top"])
        self.assertEqual(r["upi_ids"], ["task.pay@ybl"])
