export function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 16.5C5 14.5 6.5 13 8 13C9.5 13 11 14.5 11 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 9H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 12H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ConnectionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="19" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 9V12M12 12L6 15.5M12 12L18 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ExchangeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 10L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6H16C18.7614 6 21 8.23858 21 11V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 14L21 18L17 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 18H8C5.23858 18 3 15.7614 3 13V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <path d="M12 16.5V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
