from django.test import SimpleTestCase

from .llm import guard_citations, regex_entities
from .score import compute_signals, registrable, same_org, score


def ev(id, probe, facts=None, links=None):
    return {"id": id, "probe": probe, "engine": "google", "query": "", "facts": facts or {}, "links": links or []}


COMPLAINT = {"title": "x", "url": "u", "snippet": "amazon-task-jobs.xyz took my money", "label": "complaint"}


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
                    ev("E2", "regulator", {"target": "SBI", "hits": 1}, [{"title": "SBI", "url": "https://rbi.org.in/x", "label": "official"}])]
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
        sigs = compute_signals(ents, [ev("E1", "regulator", {"target": "Acme"}, [
            {"title": "SEBI order against Acme", "label": "complaint"}, {"title": "Unrelated SEBI circular", "label": "neutral"}])])
        self.assertEqual([s["code"] for s in sigs], ["REGULATOR_CLAIM_UNVERIFIED"])

    def test_regulator_pages_must_be_on_regulator_sites(self):
        off_site = {"title": "Kredito24 Loan", "url": "https://www.crunchbase.com/kredito24", "label": "official"}
        self.assertEqual(compute_signals({}, [ev("E1", "regulator", {"target": "Kredito24"}, [off_site])]), [])

    def test_complaints_must_mention_target(self):
        generic = {"title": "Amazon job scams", "url": "https://amazon.in/x", "snippet": "beware", "label": "complaint"}
        self.assertEqual(compute_signals({}, [ev("E1", "complaints", {"target": "evil.xyz"}, [generic, generic])]), [])

    def test_bands(self):
        self.assertEqual(score([{"weight": 30}]), (30, "low"))
        self.assertEqual(score([{"weight": 31}]), (31, "caution"))
        self.assertEqual(score([{"weight": 61}, {"weight": 99}]), (100, "likely_scam"))


class ProbeTests(SimpleTestCase):
    def test_official_domain_must_carry_brand_name(self):
        from .probes import official_domain
        junk = {"organic_results": [{"link": "https://sourceforge.net/x", "title": "Kredito24"},
                                    {"link": "https://fibe.india/jobs", "title": "Kredito24 jobs"}]}
        self.assertIsNone(official_domain("Kredito24")["parse"](junk)[1]["official_domain"])
        real = {"organic_results": [{"link": "https://www.facebook.com/sbi"}, {"link": "https://sbi.bank.in/web"}]}
        self.assertEqual(official_domain("SBI")["parse"](real)[1]["official_domain"], "sbi.bank.in")

    def test_widest_news_query_counts(self):
        sigs = compute_signals({"scam_pattern": "loan"}, [ev("E1", "news_pattern", {}, []), ev("E2", "news_pattern", {}, [{}, {}, {}])])
        self.assertEqual([(s["code"], s["evidence_ids"]) for s in sigs], [("PATTERN_IN_NEWS", ["E2"])])


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
