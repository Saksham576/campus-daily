/** Campus Daily mark: an open "C" (the day) with a dot (today). */
export function Logo({ className = "brand-logo" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent, #2f54eb)" />
      <path d="M21.5 10.6a8 8 0 1 0 0 10.8" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="22.4" cy="16" r="2.2" fill="#fff" />
    </svg>
  );
}
