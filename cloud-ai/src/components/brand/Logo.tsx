/**
 * Cloud AI brand marks.
 *
 * The logo is an original Cloud AI identity: a rounded-square app tile with an
 * aurora gradient (cyan -> blue -> violet -> teal), a white cloud silhouette and
 * a four-point spark cut into it. It scales from the 16px taskbar icon to the
 * loading screen without losing its silhouette. No third-party marks are used.
 */
import { cn } from '../../lib/utils'

interface LogoProps {
  size?: number
  className?: string
  title?: string
}

/** The rounded-square app icon. */
export function CloudLogo({ size = 40, className, title = 'Cloud AI' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="cloud-ai-aurora" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--aurora-cyan)" />
          <stop offset="38%" stopColor="var(--aurora-blue)" />
          <stop offset="72%" stopColor="var(--aurora-violet)" />
          <stop offset="100%" stopColor="var(--aurora-teal)" />
        </linearGradient>
        <radialGradient id="cloud-ai-glow" cx="34%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cloud-ai-sheen" x1="0" y1="1" x2="0.6" y2="0">
          <stop offset="0%" stopColor="#0b1220" stopOpacity="0.26" />
          <stop offset="55%" stopColor="#0b1220" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="128" height="128" rx="30" fill="url(#cloud-ai-aurora)" />
      <rect x="0" y="0" width="128" height="128" rx="30" fill="url(#cloud-ai-glow)" />
      <rect x="0" y="0" width="128" height="128" rx="30" fill="url(#cloud-ai-sheen)" />
      <rect
        x="1.5"
        y="1.5"
        width="125"
        height="125"
        rx="28.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.38"
        strokeWidth="2"
      />

      <g fill="#ffffff">
        <circle cx="46" cy="58" r="14" opacity="0.96" />
        <circle cx="64" cy="49" r="17" opacity="0.96" />
        <circle cx="81" cy="59" r="13" opacity="0.96" />
        <rect x="36" y="58" width="55" height="17" rx="8.5" opacity="0.96" />
      </g>

      <path
        d="M64 47 C65.9 57.6 70.4 62.1 81 64 C70.4 65.9 65.9 70.4 64 81 C62.1 70.4 57.6 65.9 47 64 C57.6 62.1 62.1 57.6 64 47 Z"
        fill="url(#cloud-ai-aurora)"
      />

      <circle cx="94" cy="34" r="5" fill="#ffffff" opacity="0.85" />
      <circle cx="34" cy="36" r="3.2" fill="#ffffff" opacity="0.6" />
    </svg>
  )
}

/** Logo + wordmark, used in the sidebar, title bar and loading screen. */
export function CloudWordmark({
  size = 34,
  compact = false,
  className,
  subtitle,
}: LogoProps & { compact?: boolean; subtitle?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <CloudLogo size={size} />
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-ink">
            Cloud<span className="aurora-text"> AI</span>
          </div>
          {subtitle && <div className="text-[11px] text-ink-muted">{subtitle}</div>}
        </div>
      )}
    </div>
  )
}
