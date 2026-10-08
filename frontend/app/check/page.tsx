"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue } from "motion/react";
import { EASE, Mark } from "@/components/Brand";
import Isometric from "@/components/Isometric";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Link = { title: string; url: string; snippet: string; label?: string };
type Evidence = {
  id: string; probe: string; engine: string; query: string; source: string; latency_ms: number;
  links: Link[]; facts: Record<string, unknown>; followup: boolean;
};
type Card = { id: string; probe: string; engine: string; query: string; followup: boolean; ev?: Evidence };
type Item = { kind: "probe"; id: string } | { kind: "followup"; reason: string };
type Signal = { code: string; weight: number; evidence_ids: string[]; detail: string };

const EXAMPLES = [
  { label: "Task-scam job", file: "task_scam.txt" },
  { label: "“SEBI” stock tip", file: "sebi_tip.txt" },
  { label: "Real bank SMS", file: "bank_sms.txt" },
  { label: "KYC screenshot", file: "kyc_screenshot.png" },
];
const PROBE_NAMES: Record<string, string> = {
  official_domain: "Find the brand's official website",
  domain_footprint: "Check the link's footprint on Google",
  complaints: "Search complaints & fraud reports",
  regulator: "Look for SEBI / RBI records",
  news_pattern: "Scan news for this scam pattern",
  lens: "Reverse-search the image",
  play_app: "Look up the app on Google Play",
  maps_office: "Verify the office on Google Maps",
};
const BAND = {
  low: { label: "Low risk", color: "#16a34a", note: "Few risk indicators found. Still never share an OTP or PIN." },
  caution: { label: "Be careful", color: "#d97706", note: "Some risk indicators found. Verify through official channels first." },
  likely_scam: { label: "Likely scam", color: "#ff4f12", note: "Multiple risk indicators found. Don't click, pay or share OTPs." },
} as const;
type Band = keyof typeof BAND;

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export default function Check() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sample, setSample] = useState("");
  const [running, setRunning] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [signals, setSignals] = useState<Signal[]>([]);
  const [result, setResult] = useState<{ score: number; band: Band } | null>(null);
  const [narrative, setNarrative] = useState<{ text: string; warning: string } | null>(null);
  const [credits, setCredits] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/api/credits`).then(r => r.json()).then(d => setCredits(d.left)).catch(() => setCredits(null));
    const ex = new URLSearchParams(window.location.search).get("example");
    if (ex && EXAMPLES.some(x => x.file === ex)) loadExample(ex);
  }, []);

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(t);
  }, [running]);

  async function loadExample(file: string) {
    setSample(file);
    const res = await fetch(`/examples/${file}`);
    if (file.endsWith(".png")) {
      setText("");
      setImage(new File([await res.blob()], file, { type: "image/png" }));
    } else {
      setText(await res.text());
      setImage(null);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NDJSON events, shape checked by `type`
  function handle(ev: any) {
    switch (ev.type) {
      case "probe_start":
        setCards(c => ({ ...c, [ev.id]: { ...ev } }));
        setItems(i => [...i, { kind: "probe", id: ev.id }]);
        break;
      case "probe_done":
        setCards(c => ({ ...c, [ev.evidence.id]: { ...c[ev.evidence.id], ev: ev.evidence } }));
        break;
      case "labels":
        setCards(c => Object.fromEntries(Object.entries(c).map(([k, v]) =>
          [k, { ...v, ev: ev.evidence.find((e: Evidence) => e.id === k) ?? v.ev }])));
        break;
      case "followup": setItems(i => [...i, { kind: "followup", reason: ev.reason }]); break;
      case "signal": setSignals(s => [...s, ev]); break;
      case "score": setResult({ score: ev.score, band: ev.band }); break;
      case "narrative": setNarrative({ text: ev.text, warning: ev.warning }); break;
      case "credits": setCredits(ev.left); break;
      case "error": setError(ev.message); break;
    }
  }

  async function check() {
    setRunning(true); setItems([]); setCards({}); setSignals([]); setResult(null); setNarrative(null); setError(""); setElapsed(0);
    if (window.innerWidth < 1024) document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" });
    const form = new FormData();
    form.append("text", text);
    if (image) form.append("image", image);
    try {
      const res = await fetch(`${API}/api/investigate`, { method: "POST", body: form });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        lines.filter(Boolean).forEach(l => handle(JSON.parse(l)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function jump(id: string) {
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(""); requestAnimationFrame(() => setFlash(id));
  }

  function pickFile(f: File | null | undefined) {
    if (f) { setImage(f); setSample(""); }
  }

  const Cite = ({ ids }: { ids: string[] }) => <>{ids.map(id => (
    <button key={id} onClick={() => jump(id)}
      className="mx-0.5 rounded bg-ink/[0.06] px-1.5 py-0.5 align-[1px] font-mono text-[10.5px] font-semibold text-ink transition hover:bg-ember hover:text-white">{id}</button>
  ))}</>;

  const probes = Object.values(cards);
  const done = probes.filter(c => c.ev).length;
  const started = running || items.length > 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-canvas px-2 py-2 text-ink sm:px-4 sm:py-4">
        <div className="mx-auto max-w-[1440px] space-y-3">
          {/* header */}
          <motion.header className="rounded-[20px] bg-white px-4 pb-8 sm:px-6"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
            <nav className="flex items-center justify-between py-5">
              <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight"><Mark /> Jhol</Link>
              <div className="flex items-center gap-5 text-[13px] font-medium">
                <Link href="/" className="hidden text-ink/70 transition hover:text-ember sm:block">Home</Link>
                <span className="flex items-center gap-2 rounded-full border border-ink/10 px-3 py-1.5 font-mono text-[11px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${credits ? "bg-green-500" : "bg-ink-3"}`} />
                  {credits === undefined ? "…" : credits === null ? "replay mode" : `${credits} SerpApi credits`}
                </span>
              </div>
            </nav>
            <div className="flex flex-wrap items-end justify-between gap-4 px-0 pt-4 sm:px-2">
              <div>
                <p className="eyebrow text-ink-2">Check a message</p>
                <h1 className="mt-3 text-[clamp(1.7rem,3.4vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
                  Kuch toh <span className="text-ember">jhol</span> hai? Let&apos;s find out.
                </h1>
              </div>
              <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-2">
                Live SerpApi searches on every link, phone, app and claim. The score comes from fixed rules, never the AI.
              </p>
            </div>
          </motion.header>

          <main className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
            {/* 01 · message */}
            <Panel delay={0.1} className="bg-white lg:sticky lg:top-3 lg:self-start">
              <Head n="01" title="Message" />
              <textarea value={text} onChange={e => { setText(e.target.value); setSample(""); }} rows={9}
                placeholder="Paste the message you received…"
                className="mt-4 w-full resize-none rounded-xl border border-transparent bg-[#f4f4f5] p-3.5 text-[14px] leading-relaxed outline-none transition placeholder:text-ink-3 focus:border-ember/40 focus:bg-white focus:ring-4 focus:ring-ember/10" />

              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
                className={`mt-2.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-[13px] transition ${drag ? "border-ember bg-ember/5" : "border-ink/15 hover:border-ember/60"}`}>
                {preview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={preview} alt="" className="h-12 w-10 rounded-md object-cover object-top ring-1 ring-ink/10" />
                  : <span className="grid h-12 w-10 place-items-center rounded-md bg-[#f4f4f5] text-lg text-ink-3">＋</span>}
                <span className="min-w-0 flex-1">
                  {image ? <><b className="block truncate font-semibold">{image.name}</b>
                    <span className="text-ink-3">Gemini reads it · Lens reverse-searches it</span></>
                    : <><b className="block font-semibold">Drop a screenshot</b><span className="text-ink-3">or click to choose · max 500 KB</span></>}
                </span>
                {image && <button className="text-[12px] font-semibold text-ink-3 hover:text-ember"
                  onClick={e => { e.stopPropagation(); setImage(null); setSample(""); }}>Remove</button>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => pickFile(e.target.files?.[0])} />
              </div>

              <p className="mt-5 text-[13px] font-semibold">Or pick a sample <span className="font-normal text-ink-3">· replayable, 0 credits</span></p>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {EXAMPLES.map(x => (
                  <button key={x.file} onClick={() => loadExample(x.file)}
                    className={`rounded-md px-2 py-2 text-[12px] font-medium transition ${sample === x.file ? "bg-ink text-white" : "bg-[#efefef] hover:bg-[#e4e4e4]"}`}>
                    {x.label}
                  </button>
                ))}
              </div>

              <button onClick={check} disabled={running || (!text.trim() && !image)}
                className="btn-ember relative mt-6 w-full overflow-hidden rounded-lg py-3 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
                {running && <motion.span className="absolute inset-y-0 left-0 bg-white/20"
                  initial={{ width: "0%" }} animate={{ width: probes.length ? `${(done / probes.length) * 100}%` : "8%" }} transition={{ duration: 0.4 }} />}
                <span className="relative">{running ? `Investigating… ${elapsed.toFixed(1)}s` : "Check it"}</span>
              </button>
              <p className="mt-2.5 text-center text-[11.5px] text-ink-3">Up to 9 live searches per check. Samples replay from cache.</p>
              <AnimatePresence>
                {error && <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-3 rounded-lg bg-red-50 p-3 text-[13px] text-red-800">{error}</motion.p>}
              </AnimatePresence>
            </Panel>

            {/* 02 · live investigation */}
            <Panel id="timeline" delay={0.18} className="relative min-h-[560px] overflow-hidden bg-ink text-white">
              <div className="flex items-center justify-between">
                <Head n="02" title="Live investigation" dark />
                {started && <span className="font-mono text-[11px] text-white/50">{done}/{probes.length} searches · {elapsed.toFixed(1)}s</span>}
              </div>
              {!started ? <IdleTimeline /> : (
                <ol className="relative mt-6">
                  <span className="absolute bottom-3 left-[11px] top-3 w-px bg-white/10" />
                  <AnimatePresence initial={false}>
                    {items.map((it, n) => it.kind === "followup"
                      ? <motion.li key={`f${n}`} className="relative ml-8 py-2 pl-5 text-[12.5px] font-medium text-ember"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                          <span className="absolute left-0 top-0 h-[18px] w-3.5 rounded-bl-lg border-b border-l border-ember/60" />
                          Follow-up · {it.reason}
                        </motion.li>
                      : <ProbeRow key={it.id} card={cards[it.id]} flash={flash === it.id} />)}
                  </AnimatePresence>
                </ol>
              )}
            </Panel>

            {/* 03 · verdict */}
            <Panel delay={0.26} className="bg-white lg:sticky lg:top-3 lg:self-start">
              <Head n="03" title="Verdict" />
              <div className="mt-5 flex items-center gap-4">
                <Gauge score={result?.score ?? 0} band={result?.band} />
                <div>
                  <AnimatePresence mode="wait">
                    <motion.p key={result?.band ?? (running ? "run" : "idle")} className="text-[22px] font-bold tracking-[-0.02em]"
                      style={{ color: result ? BAND[result.band].color : "#94959a" }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      {result ? BAND[result.band].label : running ? "Collecting evidence…" : "Waiting"}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">
                    {result ? BAND[result.band].note : "Risk score out of 100, from fixed weighted rules."}
                  </p>
                </div>
              </div>

              {signals.length > 0 && (
                <ul className="mt-6 border-t border-ink/10">
                  {signals.map((s, i) => (
                    <motion.li key={s.code} className="grid grid-cols-[44px_1fr] gap-x-2 border-b border-ink/10 py-3 text-[13px]"
                      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}>
                      <span className={`font-mono text-[13px] font-bold ${s.weight > 0 ? "text-ember" : "text-green-600"}`}>
                        {s.weight > 0 ? "+" : "−"}{Math.abs(s.weight)}</span>
                      <span>
                        <b className="font-semibold capitalize">{s.code.toLowerCase().replaceAll("_", " ")}</b>
                        <Cite ids={s.evidence_ids} />
                        <span className="mt-0.5 block text-ink-2">{s.detail}</span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}

              <AnimatePresence>
                {narrative && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                    <p className="mt-5 text-[13.5px] leading-relaxed text-ink/85">{narrative.text.split(/(\[E\d+(?:\s*,\s*E\d+)*\])/).map((part, i) => {
                      const ids = /^\[E\d/.test(part) ? part.match(/E\d+/g) : null;
                      return ids ? <Cite key={i} ids={ids} /> : <span key={i}>{part}</span>;
                    })}</p>
                    <div className="mt-5 rounded-xl bg-[#efe7de] p-3">
                      <p className="eyebrow mb-2 text-ink/50">For the family group</p>
                      <div className="whitespace-pre-line rounded-lg rounded-tl-none bg-white p-3 text-[13px] leading-relaxed shadow-sm">{narrative.warning}</div>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(narrative.warning); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
                      className="btn-ember mt-3 w-full rounded-lg py-2.5 text-[13px] font-semibold">
                      {copied ? "Copied ✓" : "Copy warning for family group"}
                    </button>
                    <p className="mt-3 text-[11.5px] leading-snug text-ink-3">
                      Jhol reports risk indicators found in public search results. It doesn&apos;t accuse anyone of fraud.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}

function Panel({ children, className = "", delay = 0, id }: { children: React.ReactNode; className?: string; delay?: number; id?: string }) {
  return (
    <motion.section id={id} className={`scroll-mt-3 rounded-[20px] p-5 sm:p-6 ${className}`}
      initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay, ease: EASE }}>
      {children}
    </motion.section>
  );
}

function Head({ n, title, dark }: { n: string; title: string; dark?: boolean }) {
  return (
    <p className="flex items-baseline gap-2.5">
      <span className="font-mono text-[13px] text-ember">{n}</span>
      <span className={`eyebrow ${dark ? "text-white/60" : "text-ink-2"}`}>{title}</span>
    </p>
  );
}

function IdleTimeline() {
  const p = useMotionValue(0.35);
  const [plate, setPlate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPlate(x => (x + 1) % 3), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-[480px] flex-col items-center justify-center text-center">
      <motion.div className="h-[320px] w-[320px]" animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
        <Isometric progress={p} active={plate} />
      </motion.div>
      <p className="mt-2 max-w-xs text-[13.5px] leading-relaxed text-white/55">
        Each live search shows up here with its engine, exact query and sources.
      </p>
    </div>
  );
}

function ProbeRow({ card, flash }: { card?: Card; flash: boolean }) {
  if (!card) return null;
  const ev = card.ev;
  const bad = Boolean(ev?.facts.inconclusive);
  return (
    <motion.li id={`card-${card.id}`} layout
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}
      className={`relative grid grid-cols-[24px_1fr] gap-3 py-3 ${card.followup ? "ml-8" : ""}`}>
      <span className="relative z-10 mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink">
        {!ev ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ember border-t-transparent" />
          : bad ? <span className="h-2.5 w-2.5 rounded-full border border-white/30" />
            : <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="grid h-4 w-4 place-items-center rounded-full bg-ember text-[9px] font-bold text-white">✓</motion.span>}
      </span>
      <div className={`min-w-0 rounded-xl border p-3.5 transition-shadow ${flash ? "flash" : ""} ${bad
        ? "border-white/5 bg-white/[0.02] text-white/45" : "border-white/10 bg-white/[0.04]"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-semibold text-ember">{card.id}</span>
          <span className="text-[13.5px] font-medium">{PROBE_NAMES[card.probe] ?? card.probe}</span>
          <span className="rounded bg-white/10 px-1.5 py-px font-mono text-[10.5px] text-white/70">{card.engine}</span>
          {ev && (
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] text-white/45">
              {bad ? "inconclusive" : `${ev.latency_ms} ms`}
              <span className={`rounded px-1.5 py-px ${ev.source === "live" ? "bg-green-500/15 text-green-300" : "bg-white/10 text-white/60"}`}>{ev.source}</span>
            </span>
          )}
        </div>
        <code className="mt-1.5 block break-all font-mono text-[11.5px] text-white/45">{card.query}</code>
        {bad && <p className="mt-1.5 text-[12px]">{String(ev?.facts.error ?? "")} · adds no risk</p>}
        {ev && !bad && (
          <div className="mt-2 space-y-1">
            {ev.links.slice(0, 2).map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[12.5px] text-white/80 hover:text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://www.google.com/s2/favicons?domain=${host(l.url)}&sz=32`} alt="" className="h-3.5 w-3.5 rounded-sm" />
                <span className="min-w-0 flex-1 truncate">{l.title || host(l.url)}</span>
                {l.label === "complaint" && <span className="rounded bg-ember/20 px-1.5 text-[10px] font-semibold text-ember">complaint</span>}
              </a>
            ))}
            {!ev.links.length && <p className="text-[12px] text-white/45">No results: that&apos;s evidence too.</p>}
          </div>
        )}
      </div>
    </motion.li>
  );
}

function Gauge({ score, band }: { score: number; band?: Band }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(v, score, { duration: 1.4, ease: EASE, onUpdate: x => setV(Math.round(x)) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from the current value
  }, [score]);
  const a = Math.PI * (1 - v / 100);
  const color = band ? BAND[band].color : "#cbbebb";
  return (
    <svg viewBox="0 0 120 70" className="w-36 shrink-0">
      <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#0a0b0b" strokeOpacity=".08" strokeWidth="9" strokeLinecap="round" />
      {v > 0 && <path d={`M10 60 A50 50 0 0 1 ${60 + 50 * Math.cos(a)} ${60 - 50 * Math.sin(a)}`} fill="none"
        stroke={color} strokeWidth="9" strokeLinecap="round" />}
      <text x="60" y="58" textAnchor="middle" fontSize="24" fontWeight="800" fill="#0a0b0b">{band ? v : "–"}</text>
    </svg>
  );
}
