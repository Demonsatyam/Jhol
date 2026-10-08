"use client";

import { useEffect, useRef, useState } from "react";

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
  { label: "Task-scam job offer", file: "task_scam.txt" },
  { label: "“SEBI registered” stock tip", file: "sebi_tip.txt" },
  { label: "Real bank SMS (control)", file: "bank_sms.txt" },
];
const PROBE_NAMES: Record<string, string> = {
  official_domain: "Find the brand's official website",
  domain_footprint: "Check the link's footprint on Google",
  complaints: "Search for complaints & fraud reports",
  regulator: "Look for SEBI / RBI records",
  news_pattern: "Scan news for this scam pattern",
  lens: "Reverse-search the image",
  play_app: "Look up the app on Google Play",
  maps_office: "Verify the office on Google Maps",
};
const BAND = {
  low: { label: "Low risk", color: "#16a34a" },
  caution: { label: "Be careful", color: "#d97706" },
  likely_scam: { label: "Likely scam", color: "#dc2626" },
} as const;
type Band = keyof typeof BAND;

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export default function Home() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/api/credits`).then(r => r.json()).then(d => setCredits(d.left)).catch(() => setCredits(null));
  }, []);

  async function loadExample(file: string) {
    setText(await (await fetch(`/examples/${file}`)).text());
    setImage(null);
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
    setRunning(true); setItems([]); setCards({}); setSignals([]); setResult(null); setNarrative(null); setError("");
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

  const Cite = ({ ids }: { ids: string[] }) => <>{ids.map(id => (
    <button key={id} onClick={() => jump(id)}
      className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs hover:bg-amber-200 dark:bg-zinc-800 dark:hover:bg-amber-900">{id}</button>
  ))}</>;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Jhol<span className="text-amber-500">?</span></h1>
          <p className="text-sm text-zinc-500">Is it a scam? Find out in 20 seconds, with sources.</p>
        </div>
        <div className="rounded-full border border-zinc-300 px-3 py-1 font-mono text-xs dark:border-zinc-700">
          SerpApi credits: {credits === undefined ? "…" : credits === null ? "replay mode" : credits}
        </div>
      </header>

      <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)]">
        {/* 1. Input */}
        <section className="space-y-3">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={11}
            placeholder="Paste the message you received"
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900" />
          <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setImage(e.dataTransfer.files[0] ?? null); }}
            className="cursor-pointer rounded-lg border-2 border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 hover:border-amber-500 dark:border-zinc-700">
            {image ? <span className="text-zinc-800 dark:text-zinc-200">📎 {image.name} <button className="ml-2 text-red-500"
              onClick={e => { e.stopPropagation(); setImage(null); }}>remove</button></span>
              : "Drop a screenshot here, or click to choose (max 500 KB for image search)"}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={e => setImage(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(x => (
              <button key={x.file} onClick={() => loadExample(x.file)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-amber-500 dark:border-zinc-700">{x.label}</button>
            ))}
          </div>
          <button onClick={check} disabled={running || (!text.trim() && !image)}
            className="w-full rounded-lg bg-amber-500 py-2.5 font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40">
            {running ? "Investigating…" : "Check it"}
          </button>
          {error && <p className="rounded bg-red-100 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
        </section>

        {/* 2. Timeline */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Investigation</h2>
          {!items.length && <p className="text-sm text-zinc-500">Each live search shows up here with its exact query and sources.</p>}
          {items.map((it, n) => it.kind === "followup"
            ? <div key={n} className="ml-6 text-xs font-medium text-amber-600">↳ Follow-up: {it.reason}</div>
            : <ProbeCard key={it.id} card={cards[it.id]} flash={flash === it.id} />)}
        </section>

        {/* 3. Verdict */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Verdict</h2>
          {result ? <Gauge score={result.score} band={result.band} />
            : <p className="text-sm text-zinc-500">{running ? "Collecting evidence…" : "The score is computed from fixed rules, never by the AI."}</p>}
          {signals.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {signals.map(s => (
                <li key={s.code} className="flex gap-2">
                  <span className={`w-10 shrink-0 text-right font-mono font-bold ${s.weight > 0 ? "text-red-600" : "text-green-600"}`}>
                    {s.weight > 0 ? "+" : ""}{s.weight}</span>
                  <span><b className="capitalize">{s.code.toLowerCase().replaceAll("_", " ")}</b>
                    <span className="text-zinc-500"> · {s.detail}</span><Cite ids={s.evidence_ids} /></span>
                </li>
              ))}
            </ul>
          )}
          {narrative && (
            <>
              <p className="text-sm leading-relaxed">{narrative.text.split(/(\[E\d+\])/).map((part, i) => {
                const m = part.match(/^\[(E\d+)\]$/);
                return m ? <Cite key={i} ids={[m[1]]} /> : <span key={i}>{part}</span>;
              })}</p>
              <div className="rounded-lg border border-zinc-300 bg-white p-3 text-sm whitespace-pre-line dark:border-zinc-700 dark:bg-zinc-900">
                {narrative.warning}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(narrative.warning); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500">
                {copied ? "Copied ✓" : "Copy warning for family group"}
              </button>
              <p className="text-xs text-zinc-500">Jhol reports risk indicators found in public search results. It doesn&apos;t accuse anyone of fraud.</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function ProbeCard({ card, flash }: { card?: Card; flash: boolean }) {
  if (!card) return null;
  const ev = card.ev;
  const bad = Boolean(ev?.facts.inconclusive);
  return (
    <div id={`card-${card.id}`}
      className={`rounded-lg border p-3 text-sm ${card.followup ? "ml-6" : ""} ${flash ? "flash" : ""} ${bad
        ? "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-zinc-400">{card.id}</span>
        <span className="font-medium">{PROBE_NAMES[card.probe] ?? card.probe}</span>
        <span className="rounded bg-sky-100 px-1.5 font-mono text-[11px] text-sky-800 dark:bg-sky-950 dark:text-sky-300">{card.engine}</span>
        <span className="ml-auto text-xs">
          {!ev ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            : <>{bad ? "⚠ inconclusive" : "✓"} <span className="text-zinc-400">{ev.latency_ms} ms</span>
              <span className={`ml-1.5 rounded px-1 font-mono text-[10px] ${ev.source === "live" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>{ev.source}</span></>}
        </span>
      </div>
      <code className="mt-1 block break-all text-xs text-zinc-500">{card.query}</code>
      {bad && <p className="mt-1 text-xs">{String(ev?.facts.error ?? "")} (adds no risk)</p>}
      {ev && !bad && ev.links.slice(0, 2).map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noreferrer" className="mt-1.5 flex items-start gap-2 hover:underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://www.google.com/s2/favicons?domain=${host(l.url)}&sz=32`} alt="" className="mt-0.5 h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">{l.title || host(l.url)}</span>
          {l.label === "complaint" && <span className="rounded bg-red-100 px-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">complaint</span>}
        </a>
      ))}
      {ev && !bad && !ev.links.length && <p className="mt-1 text-xs text-zinc-500">No results.</p>}
    </div>
  );
}

function Gauge({ score, band }: { score: number; band: Band }) {
  const { label, color } = BAND[band];
  const a = Math.PI * (1 - score / 100);
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 70" className="w-40">
        <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="10" strokeLinecap="round" />
        {score > 0 && <path d={`M10 60 A50 50 0 0 1 ${60 + 50 * Math.cos(a)} ${60 - 50 * Math.sin(a)}`}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />}
        <text x="60" y="58" textAnchor="middle" fontSize="24" fontWeight="800" fill="currentColor">{score}</text>
      </svg>
      <div>
        <div className="text-2xl font-black" style={{ color }}>{label}</div>
        <div className="text-xs text-zinc-500">risk score out of 100</div>
      </div>
    </div>
  );
}
