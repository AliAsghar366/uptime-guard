export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_0_18px_rgba(45,212,191,0.35)]"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="56" y2="56">
          <stop offset="0%" stopColor="#3b9ef5" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <path
        d="M28 4L47 12V27C47 38 39 47 28 52C17 47 9 38 9 27V12L28 4Z"
        stroke="url(#logoGradient)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.05)"
      />
      <path
        d="M14 29H21L24 21L29 37L32 29H42"
        stroke="url(#logoGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}