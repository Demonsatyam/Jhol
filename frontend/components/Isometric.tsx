"use client";

import { motion, useTransform, type MotionValue } from "motion/react";

// Three exploded plates, drawn as vertical planes in isometric: Message -> Probes -> Verdict.
const W = 230, H = 300;
const ISO = "matrix(0.866,0.5,0,1,0,0)";
const EMBER = "#ff4f12";

function Holes() {
  return <>{[[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]].map(([x, y]) =>
    <circle key={`${x}${y}`} cx={x} cy={y} r={5} />)}</>;
}

function MessagePlate() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={30} y={60 + i * 34} width={9} height={14} rx={1.5} />)}
      <rect x={56} y={40} width={150} height={44} rx={8} />
      <line x1={70} y1={56} x2={170} y2={56} /><line x1={70} y1={68} x2={140} y2={68} />
      <rect x={56} y={98} width={150} height={56} rx={8} />
      <line x1={70} y1={114} x2={190} y2={114} /><line x1={70} y1={126} x2={176} y2={126} /><line x1={70} y1={138} x2={120} y2={138} />
      <rect x={56} y={168} width={150} height={30} rx={8} fill={EMBER} fillOpacity={0.12} />
      <line x1={70} y1={183} x2={180} y2={183} strokeDasharray="3 3" />
      <path d="M131 222 L151 256 L111 256 Z" /><line x1={131} y1={234} x2={131} y2={244} /><circle cx={131} cy={250} r={1} />
    </>
  );
}

function ProbePlate() {
  const cells = Array.from({ length: 8 }, (_, i) => [34 + (i % 3) * 58, 40 + Math.floor(i / 3) * 70] as const);
  return (
    <>
      {cells.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width={42} height={42} rx={4} />
          {[0, 1, 2].map(k => <rect key={k} x={x - 7} y={y + 8 + k * 10} width={4} height={4} />)}
          {i % 2 ? <circle cx={x + 21} cy={y + 21} r={9} /> : <path d={`M${x + 11} ${y + 27} l7 -8 l6 5 l8 -10`} />}
        </g>
      ))}
      <rect x={150} y={180} width={46} height={68} rx={4} />
      <line x1={160} y1={196} x2={186} y2={196} /><line x1={160} y1={208} x2={180} y2={208} />
    </>
  );
}

function VerdictPlate() {
  return (
    <>
      <g strokeOpacity={0.55}>
        {Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={22 + i * 15.5} y1={30} x2={22 + i * 15.5} y2={H - 30} />)}
        {Array.from({ length: 16 }, (_, i) => <line key={`h${i}`} x1={22} y1={30 + i * 16} x2={W - 22} y2={30 + i * 16} />)}
      </g>
      <path d={`M45 190 A70 70 0 0 1 185 190`} strokeWidth={6} stroke="#0a0b0b" />
      <path d={`M45 190 A70 70 0 0 1 185 190`} strokeWidth={2} />
      <path d={`M45 190 A70 70 0 0 1 164 141`} strokeWidth={5} />
      <line x1={115} y1={190} x2={160} y2={150} strokeWidth={2} />
      <circle cx={115} cy={190} r={5} fill="#0a0b0b" />
    </>
  );
}

const PLATES = [MessagePlate, ProbePlate, VerdictPlate];

export default function Isometric({ progress, active }: { progress: MotionValue<number>; active: number }) {
  const spread = useTransform(progress, [0, 1], [64, 112]);
  return (
    <svg viewBox="0 0 640 640" className="h-full w-full overflow-visible" fill="none" stroke={EMBER}
      strokeWidth={1.15} strokeLinejoin="round" strokeLinecap="round">
      {[2, 1, 0].map(i => <Plate key={i} i={i} spread={spread} on={active === i} />)}
    </svg>
  );
}

function Plate({ i, spread, on }: { i: number; spread: MotionValue<number>; on: boolean }) {
  // depth axis in screen space points up-right
  const x = useTransform(spread, s => 110 + i * s * 0.866 * 1.4);
  const y = useTransform(spread, s => 210 - i * s * 0.5 * 1.4);
  const Body = PLATES[i];
  return (
    <motion.g style={{ x, y }} animate={{ opacity: on ? 1 : 0.42 }} transition={{ duration: 0.5 }}>
      <g transform="translate(-8,4.6)" strokeOpacity={0.6}>
        <g transform={ISO}><rect width={W} height={H} rx={12} fill="#0a0b0b" /></g>
      </g>
      <g transform={ISO}>
        <rect width={W} height={H} rx={12} fill="#0a0b0b" />
        <motion.rect width={W} height={H} rx={12} fill={EMBER} stroke="none"
          animate={{ fillOpacity: on ? 0.07 : 0 }} transition={{ duration: 0.5 }} />
        <Holes />
        <Body />
      </g>
    </motion.g>
  );
}
