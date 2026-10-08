export const EASE = [0.22, 1, 0.36, 1] as const;

export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M13 2.6a6 6 0 0 1 6 0l8.3 4.8a6 6 0 0 1 3 5.2v6.8a6 6 0 0 1-3 5.2L19 29.4a6 6 0 0 1-6 0l-8.3-4.8a6 6 0 0 1-3-5.2v-6.8a6 6 0 0 1 3-5.2Z" fill="#ff4f12" />
      <circle cx="15" cy="14.5" r="5.2" fill="none" stroke="white" strokeWidth="2.6" />
      <path d="m19 18.6 3.6 3.6" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
