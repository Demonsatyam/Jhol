"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence, MotionConfig, animate, motion, useInView, useMotionValueEvent, useScroll, useTransform,
} from "motion/react";
import Isometric from "@/components/Isometric";

const EASE = [0.22, 1, 0.36, 1] as const;

const SAMPLES = [
  { file: "task_scam.txt", label: "Task-scam job", text: "Hello! I am Priya from Amazon HR team 😊 We are hiring part-time Work From Home staff. Earn ₹3,000 – ₹8,000 daily… Register now: amazon-taskjobs-in.top/join" },
  { file: "sebi_tip.txt", label: "“SEBI” stock tip", text: "🚀 VRIDDHI ALPHA CAPITAL ADVISORS — SEBI Registered Research Analyst. Guaranteed 10–15% weekly profit. Install “VAC Trade Pro” for IPO allotment." },
  { file: "bank_sms.txt", label: "Real bank SMS", text: "Dear Customer, your A/c XX4821 is debited by Rs.2,500.00 on 08Oct26… If not done by you, call 1800 1234 or report at sbi.bank.in -SBI" },
  { file: "kyc_screenshot.png", label: "KYC screenshot", text: "📷 Screenshot: “Dear SBI YONO customer, your account will be BLOCKED today due to pending KYC/PAN update…” sbi-yono-kyc.in/update" },
];

export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-canvas px-2 py-2 text-ink sm:px-4 sm:py-4">
        <div className="mx-auto max-w-[1440px] space-y-3 sm:space-y-4">
          <Hero />
          <Probes />
          <Evidence />
          <Workflow />
          <TryIt />
          <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 pt-2 text-xs text-ink-3">
            <span>Jhol · SerpApi India Hackathon 2026 · MIT</span>
            <span>Jhol reports risk indicators found in public search results, never verdicts about people.</span>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------- brand */

function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M13 2.6a6 6 0 0 1 6 0l8.3 4.8a6 6 0 0 1 3 5.2v6.8a6 6 0 0 1-3 5.2L19 29.4a6 6 0 0 1-6 0l-8.3-4.8a6 6 0 0 1-3-5.2v-6.8a6 6 0 0 1 3-5.2Z" fill="#ff4f12" />
      <circle cx="15" cy="14.5" r="5.2" fill="none" stroke="white" strokeWidth="2.6" />
      <path d="m19 18.6 3.6 3.6" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function Rise({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.9, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- 1. hero */

function Hero() {
  const lines = ["Kuch toh jhol hai?", "Find out in 20 seconds, with sources."];
  return (
    <section className="relative overflow-hidden rounded-[20px] bg-white px-4 pb-4 sm:px-6 sm:pb-6">
      <nav className="flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
          <Mark /> Jhol
        </Link>
        <div className="hidden gap-8 text-[13px] font-medium text-ink/80 md:flex">
          {[["How it works", "#workflow"], ["Probes", "#probes"], ["Evidence", "#evidence"], ["Try it", "#try"]].map(([t, h]) =>
            <a key={h} href={h} className="transition hover:text-ember">{t}</a>)}
        </div>
        <Link href="/check" className="text-[13px] font-semibold text-ember md:hidden">Check →</Link>
      </nav>

      <div className="mx-auto max-w-5xl pb-14 pt-12 text-center sm:pt-16">
        <motion.p className="eyebrow text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          Scam intelligence for India
        </motion.p>
        <h1 className="mt-6 text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
          {lines.map((line, li) => (
            <span key={li} className="block">
              {line.split(" ").map((w, wi) => (
                <span key={wi} className="inline-block overflow-hidden pb-1 align-bottom">
                  <motion.span className={`inline-block ${li === 0 && wi === 2 ? "text-ember" : ""}`}
                    initial={{ y: "110%" }} animate={{ y: 0 }}
                    transition={{ duration: 0.9, delay: 0.15 + li * 0.25 + wi * 0.06, ease: EASE }}>
                    {w}&nbsp;
                  </motion.span>
                </span>
              ))}
            </span>
          ))}
        </h1>
        <motion.p className="mx-auto mt-7 max-w-xl text-[15px] leading-relaxed text-ink/80 sm:text-base"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8, ease: EASE }}>
          Jhol runs live Google, News, Lens, Play and Maps searches on every link, phone, app and claim in a
          suspicious message, then scores the risk with fixed, auditable rules. Every signal links to its evidence.
        </motion.p>
        <motion.div className="mt-9 flex flex-wrap justify-center gap-2.5"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.95, ease: EASE }}>
          <Link href="/check" className="btn-ember rounded-md px-4 py-2.5 text-[13px] font-semibold">Check a message</Link>
          <a href="#workflow" className="rounded-md border border-ink/10 bg-white px-4 py-2.5 text-[13px] font-semibold shadow-sm transition hover:border-ink/30">
            See how it works</a>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[PhoneTile, ReleaseTile, GaugeTile, TrailsTile].map((T, i) => (
          <motion.div key={i} className="relative h-[340px] overflow-hidden rounded-[6px] bg-ink"
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 1.05 + i * 0.12, ease: EASE }}>
            <T />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function PhoneTile() {
  return (
    <div className="grain relative h-full bg-[radial-gradient(120%_70%_at_50%_110%,#5a1d08_0%,#170b07_45%,#0a0b0b_75%)]">
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(50%_100%_at_50%_100%,rgba(255,79,18,.45),transparent)]" />
      <motion.div className="absolute left-1/2 top-9 w-[190px] -translate-x-1/2 rounded-[26px] border border-white/15 bg-[#0d1110] p-2 shadow-[0_30px_60px_-10px_rgba(0,0,0,.9)]"
        initial={{ rotate: -9 }} animate={{ rotate: [-9, -7, -9], y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
        <div className="rounded-[19px] bg-[#0b141a] pb-6">
          <div className="flex items-center gap-2 rounded-t-[19px] bg-[#1f2c33] px-3 py-2.5">
            <div className="h-5 w-5 rounded-full bg-white/20" />
            <div className="text-[9px] leading-tight text-white"><b>Amazon HR</b><div className="text-white/50">+91 98765 43210</div></div>
          </div>
          <div className="mx-2 mt-3 rounded-lg rounded-tl-none bg-[#202c33] p-2 text-[9px] leading-snug text-white/85">
            Earn ₹3,000–₹8,000 daily by liking products 😊 Register now:
            <span className="mt-1 block text-[#53bdeb]">amazon-taskjobs-in.top/join</span>
          </div>
          <motion.div className="mx-2 mt-2 inline-flex items-center gap-1 rounded-full bg-ember px-2 py-0.5 text-[8.5px] font-semibold text-white"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 2.4, type: "spring", stiffness: 260 }}>
            ⚑ Not Amazon&apos;s domain
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

const MINI_ROWS = [
  ["E1", "google", "\"Amazon\" official website", "cache"],
  ["E2", "google", "site:amazon-taskjobs-in.top", "live"],
  ["E3", "google_news", "task-based part-time job scam", "live"],
  ["E4", "google_play", "TaskEarn Pro", "live"],
  ["E5", "google", "\"amazon-taskjobs-in.top\" scam OR…", "live"],
];

function ReleaseTile() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(v => (v + 1) % (MINI_ROWS.length + 3)), 850);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full flex-col p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Oct 08, 2026</p>
      <p className="mt-2 text-[15px] font-medium leading-snug text-white">
        Live investigation: 9 searches, one follow-up hop, every claim cited.
      </p>
      <div className="mt-auto -mb-5 ml-0 mr-[-20px] translate-y-3 rounded-tl-lg border border-white/10 bg-white p-2.5 text-ink">
        <div className="mb-2 flex gap-1">{["#ff5f57", "#febc2e", "#28c840"].map(c =>
          <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}</div>
        <div className="space-y-1">
          {MINI_ROWS.map(([id, engine, q, src], i) => (
            <div key={id} className="flex items-center gap-1.5 border-b border-ink/5 pb-1 text-[8.5px]">
              <span className="font-mono text-ink-3">{id}</span>
              <span className="rounded bg-sky-100 px-1 font-mono text-[7.5px] text-sky-800">{engine}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-ink-2">{q}</span>
              {i < n
                ? <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className={`rounded px-1 font-mono text-[7px] ${src === "live" ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>✓ {src}</motion.span>
                : <span className="h-2 w-2 animate-spin rounded-full border border-ember border-t-transparent" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GaugeTile() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, 75, { duration: 2.2, delay: 1.6, ease: EASE, onUpdate: x => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView]);
  const a = Math.PI * (1 - v / 100);
  return (
    <div ref={ref} className="relative h-full bg-[linear-gradient(160deg,#1b1c1e,#0a0b0b)]">
      <div className="absolute inset-0 opacity-[0.12] [background:repeating-linear-gradient(90deg,#fff_0_1px,transparent_1px_28px),repeating-linear-gradient(0deg,#fff_0_1px,transparent_1px_28px)]" />
      <div className="absolute inset-x-0 top-12 flex flex-col items-center">
        <svg viewBox="0 0 120 70" className="w-48">
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="white" strokeOpacity=".12" strokeWidth="9" strokeLinecap="round" />
          {v > 0 && <path d={`M10 60 A50 50 0 0 1 ${60 + 50 * Math.cos(a)} ${60 - 50 * Math.sin(a)}`} fill="none"
            stroke={v > 60 ? "#ff4f12" : v > 30 ? "#f59e0b" : "#22c55e"} strokeWidth="9" strokeLinecap="round" />}
          <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill="white">{v}</text>
        </svg>
        <p className="mt-1 text-sm font-bold text-ember">{v > 60 ? "Likely scam" : " "}</p>
      </div>
      <Link href="/check?example=task_scam.txt"
        className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-white/20 bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-md transition hover:bg-white/20">
        <span className="text-[9px]">▶</span> Watch it investigate
      </Link>
    </div>
  );
}

function TrailsTile() {
  const trails = [
    { d: "M-20 330 C 90 300, 170 250, 210 175 S 250 120, 262 110", c: "url(#tr-red)", w: 5 },
    { d: "M10 345 C 120 310, 190 260, 225 185 S 262 125, 270 112", c: "url(#tr-red)", w: 3 },
    { d: "M-30 300 C 60 285, 150 235, 196 170 S 238 122, 254 108", c: "url(#tr-white)", w: 2.5 },
    { d: "M40 350 C 150 320, 210 270, 240 195 S 270 130, 276 114", c: "url(#tr-ember)", w: 2 },
  ];
  return (
    <div className="relative flex h-full flex-col bg-black p-5">
      <p className="text-[15px] font-medium leading-snug text-white">Built for families who check before they forward.</p>
      <p className="mt-4 flex items-center gap-3 text-[15px] font-bold text-white">
        <span className="flex items-center gap-1.5"><Mark className="h-5 w-5" /> Jhol</span>
        <span className="text-white/40">×</span>
        <span className="font-extrabold tracking-tight">SERP<span className="text-ember">API</span></span>
      </p>
      <svg viewBox="0 0 300 340" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="tr-red" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ff2a00" /><stop offset="1" stopColor="#ff2a00" stopOpacity="0" /></linearGradient>
          <linearGradient id="tr-ember" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ff8a3d" /><stop offset="1" stopColor="#ff8a3d" stopOpacity="0" /></linearGradient>
          <linearGradient id="tr-white" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#fff6e8" /><stop offset="1" stopColor="#fff6e8" stopOpacity="0" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g filter="url(#glow)" fill="none" strokeLinecap="round">
          {trails.map((t, i) => (
            <motion.path key={i} d={t.d} stroke={t.c} strokeWidth={t.w}
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 3.2, delay: 1.4 + i * 0.35, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut", times: [0, 0.6, 1] }} />
          ))}
        </g>
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------- 2. probe stack */

const PROBES = [
  { name: "Google Search", engine: "google", q: "site:amazon-taskjobs-in.top", fact: "0 pages indexed", sig: "+15 Zero footprint",
    desc: "Finds the brand's real website, checks whether a link exists on Google at all, and hunts complaints and SEBI/RBI records." },
  { name: "Google News", engine: "google_news", q: "task-based part-time job scam", fact: "37 articles", sig: "+15 Pattern in news",
    desc: "Matches the message's pattern against recent scam reporting from Indian newsrooms." },
  { name: "Google Lens", engine: "google_lens", q: "(uploaded screenshot)", fact: "matches on stock sites", sig: "+20 Stolen image",
    desc: "Reverse-searches screenshots and profile photos to catch stolen or stock images posing as real people." },
  { name: "Google Play", engine: "google_play", q: "TaskEarn Pro", fact: "not found", sig: "+15 App red flags",
    desc: "Checks whether the app you're told to install exists, who publishes it, and how many people actually use it." },
  { name: "Google Maps", engine: "google_maps", q: "Dalal Street Commercial Tower, Fort", fact: "no business found", sig: "+10 Ghost office",
    desc: "Verifies that the claimed office is a real place, with real reviews, at that address." },
];

function Probes() {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover) return;
    const t = setInterval(() => setActive(a => (a + 1) % PROBES.length), 3200);
    return () => clearInterval(t);
  }, [hover]);
  const p = PROBES[active];
  return (
    <section id="probes" className="rounded-[20px] bg-white px-5 py-16 sm:px-12 sm:py-20 lg:px-[4.5%]">
      <Rise><p className="eyebrow text-ink">Probe stack</p></Rise>
      <Rise delay={0.08}>
        <h2 className="mt-5 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.035em]">
          Built on live search.<br />Powered by fixed, auditable rules.
        </h2>
      </Rise>
      <div className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-[260px_1fr] lg:gap-0">
        <div className="lg:pt-12">
          <div className="relative h-[300px] overflow-hidden rounded-xl bg-[linear-gradient(160deg,#f6f6f7,#e9e9eb)] p-5">
            <AnimatePresence mode="wait">
              <motion.div key={active} className="flex h-full flex-col"
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: EASE }}>
                <span className="w-fit rounded bg-ink px-2 py-1 font-mono text-[11px] text-white">engine={p.engine}</span>
                <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3 shadow-[0_12px_30px_-14px_rgba(0,0,0,.25)]">
                  <p className="font-mono text-[11px] text-ink-3">q</p>
                  <p className="mt-0.5 break-words font-mono text-[12.5px] text-ink">{p.q}</p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {p.fact}
                </div>
                <div className="mt-auto rounded-lg bg-ember/10 px-3 py-2 font-mono text-[12px] font-semibold text-ember">{p.sig}</div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <ul onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          {PROBES.map((x, i) => (
            <li key={x.name} onMouseEnter={() => setActive(i)} onClick={() => setActive(i)}
              className={`grid cursor-default grid-cols-[28px_1fr] gap-x-4 gap-y-2 border-ink/10 py-8 sm:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,1.1fr)] lg:py-10 ${i < PROBES.length - 1 ? "border-b" : ""}`}>
              <div className="flex justify-end pt-0.5 sm:pr-6">
                <motion.span className="text-xl leading-none text-ember" animate={{ opacity: active === i ? 1 : 0, x: active === i ? 0 : -14 }}
                  transition={{ duration: 0.35, ease: EASE }}>→</motion.span>
              </div>
              <h3 className={`text-lg font-semibold tracking-[-0.02em] transition-colors sm:text-[19px] ${active === i ? "text-ink" : "text-ink/70"}`}>{x.name}</h3>
              <p className="col-start-2 max-w-md text-[15px] leading-relaxed text-ink/75 sm:col-start-3">{x.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 3. evidence */

function Evidence() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const shotY = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const shotR = useTransform(scrollYProgress, [0, 1], [-10, 4]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  return (
    <section id="evidence" ref={ref} className="relative overflow-hidden rounded-[20px] bg-white">
      <svg width="0" height="0" className="absolute">
        <clipPath id="hex" clipPathUnits="objectBoundingBox">
          <path d="M0.2,0 L1,0 L1,1 L0.2,1 Q0.155,1 0.135,0.955 L0.012,0.545 Q0,0.5 0.012,0.455 L0.135,0.045 Q0.155,0 0.2,0 Z" />
        </clipPath>
      </svg>
      <div className="grid min-h-[620px] items-center lg:grid-cols-2">
        <div className="relative z-10 px-5 py-16 sm:px-12 lg:static lg:py-24 lg:pl-[9%]">
          <Rise><p className="eyebrow text-ink-2 lg:absolute lg:left-[9%] lg:top-[72px]">Full evidence</p></Rise>
          <Rise delay={0.1}>
            <p className="mt-8 max-w-[34rem] text-[clamp(1.35rem,2.2vw,1.75rem)] leading-[1.32] tracking-[-0.02em] lg:mt-0">
              We connect links, phones, apps and claims into one investigation, turning a forwarded message into
              cited evidence and a clear verdict your family can act on.
            </p>
          </Rise>
          <Rise delay={0.2}>
            <Link href="/check" className="btn-ember mt-8 inline-block rounded-md px-4 py-2.5 text-[13px] font-semibold">Check a message</Link>
          </Rise>
        </div>
        <motion.div className="relative h-[460px] lg:my-16 lg:h-[540px]" style={{ clipPath: "url(#hex)" }}
          initial={{ opacity: 0, x: 80 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.2, ease: EASE }}>
          <motion.div className="absolute inset-[-10%] bg-[linear-gradient(180deg,#3b4a6b_0%,#7a5a7e_38%,#e0703f_62%,#2a1a20_63%,#120d10_100%)]" style={{ y: bgY }} />
          <div className="absolute inset-x-0 top-[58%] h-24 bg-[radial-gradient(60%_100%_at_40%_0%,rgba(255,140,60,.55),transparent)]" />
          <motion.div className="absolute left-[30%] top-[10%] w-[210px] overflow-hidden rounded-xl shadow-[0_40px_80px_-20px_rgba(0,0,0,.8)] sm:w-[240px]"
            style={{ y: shotY, rotate: shotR }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/examples/kyc_screenshot.png" alt="Example KYC scam message screenshot" className="block w-full" />
          </motion.div>
          {[
            { t: "E1 · official site: sbi.bank.in", c: "bg-white text-ink", pos: "left-[22%] top-[66%]", d: 0.5 },
            { t: "+30 Impersonation", c: "bg-ember text-white", pos: "left-[58%] top-[30%]", d: 0.75 },
            { t: "E2 · 0 pages indexed", c: "bg-white text-ink", pos: "left-[62%] top-[56%]", d: 1 },
          ].map(b => (
            <motion.span key={b.t} className={`absolute ${b.pos} ${b.c} rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold shadow-xl`}
              initial={{ opacity: 0, scale: 0.6, y: 10 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: b.d, type: "spring", stiffness: 220, damping: 18 }}>{b.t}</motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 4. workflow (scroll-driven) */

const STEPS = [
  { t: "Read the message", d: "Gemini reads text or a screenshot and pulls out brands, links, phones, UPI IDs, apps and claims. Regex double-checks every link.", plate: 0 },
  { t: "Find the official site", d: "A live Google search finds the brand's real domain, so look-alikes stand out immediately.", plate: 0 },
  { t: "Check the footprint", d: "A site: search shows whether the link exists on Google at all. Scam domains are usually days old.", plate: 1 },
  { t: "Follow the look-alike", d: "When a link isn't the official domain, Jhol hops: it searches complaints about that exact domain.", plate: 1 },
  { t: "Verify every claim", d: "SEBI and RBI records, Play Store listings and Maps offices are checked in parallel, all through SerpApi.", plate: 1 },
  { t: "Score with fixed rules", d: "Eleven weighted signals add up to a 0–100 score. The AI never sets the number, so the result is auditable.", plate: 2 },
  { t: "Cite every claim", d: "The explanation links each sentence to the search that proves it. Invented citations are stripped.", plate: 2 },
  { t: "Warn the family", d: "A short Hindi + English warning, ready to paste into the family WhatsApp group.", plate: 2 },
];

function Workflow() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", p => setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))));
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <section id="workflow" ref={ref} className="relative h-[420vh] rounded-[20px] bg-ink text-white">
      <div className="sticky top-0 grid h-screen items-center overflow-hidden rounded-[20px] px-5 sm:px-12 lg:grid-cols-[1fr_1fr] lg:px-[4.5%]">
        <div className="relative z-10">
          <p className="eyebrow text-white/55">Investigation workflow</p>
          <h2 className="mt-5 text-[clamp(1.8rem,3.6vw,2.6rem)] font-normal leading-[1.1] tracking-[-0.035em]">
            From every forward<br />to a safer decision.
          </h2>
          <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-white/60 sm:text-[15px]">
            Jhol turns one suspicious message into a chain of live searches, a deterministic score and a cited
            explanation, before you click, pay or share an OTP.
          </p>
          <ol className="mt-8 space-y-1 sm:mt-10">
            {STEPS.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.t} className="grid grid-cols-[44px_1fr] items-baseline">
                  <motion.span className="font-mono text-[15px] sm:text-[19px]"
                    animate={{ color: on ? "#ff4f12" : "rgba(255,255,255,0.14)" }}>{String(i + 1).padStart(2, "0")}</motion.span>
                  <div>
                    <motion.p className="font-light tracking-[-0.025em]"
                      animate={{ opacity: on ? 1 : Math.max(0.12, 0.34 - Math.abs(i - active) * 0.07), fontSize: on ? "clamp(1.4rem,2.6vw,2.15rem)" : "clamp(1.05rem,2vw,1.7rem)" }}
                      transition={{ duration: 0.45, ease: EASE }}>{s.t}</motion.p>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p className="max-w-md overflow-hidden text-[13.5px] leading-relaxed text-white/65 sm:text-[15px]"
                          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease: EASE }}>
                          <span className="block pb-4 pt-2">{s.d}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-[-3%] hidden w-[56%] items-center lg:flex">
          <div className="aspect-square w-full"><Isometric progress={scrollYProgress} active={STEPS[active].plate} /></div>
        </div>
        <div className="absolute bottom-6 left-5 right-5 h-px bg-white/10 sm:left-12 sm:right-12 lg:left-[4.5%] lg:right-[4.5%]">
          <motion.div className="h-px bg-ember" style={{ width: bar }} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 5. try it */

function TryIt() {
  const [sel, setSel] = useState(0);
  const s = SAMPLES[sel];
  return (
    <section id="try" className="relative overflow-hidden rounded-[20px] bg-[#fafafa] px-4 pb-24 pt-20 sm:pb-36 sm:pt-24">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[3%] flex select-none items-end justify-center gap-[3vw] text-[#f0f0f1]">
        <svg viewBox="0 0 32 32" className="w-[22vw] max-w-[300px]"><path d="M13 2.6a6 6 0 0 1 6 0l8.3 4.8a6 6 0 0 1 3 5.2v6.8a6 6 0 0 1-3 5.2L19 29.4a6 6 0 0 1-6 0l-8.3-4.8a6 6 0 0 1-3-5.2v-6.8a6 6 0 0 1 3-5.2Z" fill="currentColor" /></svg>
        <span className="text-[24vw] font-bold leading-[0.8] tracking-[-0.06em] lg:text-[20rem]">Jhol</span>
      </div>
      <div className="relative">
        <Rise><p className="eyebrow text-center text-ink">Try it</p></Rise>
        <Rise delay={0.08}>
          <h2 className="mx-auto mt-5 max-w-3xl text-center text-[clamp(1.8rem,3.6vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.035em]">
            See the jhol before it becomes a loss.<br />Check a message today.
          </h2>
        </Rise>
        <Rise delay={0.16} className="mx-auto mt-14 max-w-[880px]">
          <div className="overflow-hidden rounded-xl border border-ink/5 bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,.25)]">
            <div className="grid md:grid-cols-[1fr_1.15fr_1fr] md:divide-x divide-ink/10">
              <div className="flex flex-col p-5">
                <p className="text-[15px] font-semibold tracking-tight">Check a message</p>
                <p className="mt-3 text-[13px] font-medium">In about 20 seconds, Jhol will:</p>
                <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                  {["Find the brand's official website", "Check every link's Google footprint", "Search complaints, news, Play & Maps", "Score with fixed, cited rules"].map(x =>
                    <li key={x}>· {x}</li>)}
                </ul>
                <div className="mt-8 flex gap-4 text-[12.5px] font-medium md:mt-auto">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-ember" />SerpApi</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[conic-gradient(#4285f4,#ea4335,#fbbc05,#34a853,#4285f4)]" />Gemini</span>
                </div>
              </div>
              <div className="border-t border-ink/10 p-5 md:border-t-0">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold tracking-tight">Sample <span className="text-ink-3">{sel + 1} / {SAMPLES.length}</span></p>
                  <div className="flex gap-3 text-ink-3">
                    <button aria-label="Previous sample" className="hover:text-ink" onClick={() => setSel((sel + SAMPLES.length - 1) % SAMPLES.length)}>‹</button>
                    <button aria-label="Next sample" className="hover:text-ink" onClick={() => setSel((sel + 1) % SAMPLES.length)}>›</button>
                  </div>
                </div>
                <div className="mt-4 h-[188px] rounded-lg bg-[#efe7de] p-3">
                  <AnimatePresence mode="wait">
                    <motion.div key={sel} className="rounded-lg rounded-tl-none bg-white p-3 text-[12.5px] leading-relaxed text-ink shadow-sm"
                      initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease: EASE }}>
                      {s.text}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="border-t border-ink/10 p-5 md:border-t-0">
                <p className="text-[15px] font-semibold tracking-tight">Pick a sample</p>
                <p className="mt-1 text-[12.5px] text-ink-3">Replayable · 0 credits</p>
                <div className="mt-4 grid grid-cols-2 gap-1.5">
                  {SAMPLES.map((x, i) => (
                    <button key={x.file} onClick={() => setSel(i)}
                      className={`rounded-md px-2 py-2 text-[12px] font-medium transition ${i === sel ? "bg-ink text-white" : "bg-[#efefef] text-ink hover:bg-[#e4e4e4]"}`}>
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-ink/10 p-4">
              <Link href={`/check?example=${s.file}`} className="btn-ember rounded-md px-5 py-2.5 text-[13px] font-semibold">Check it</Link>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}
