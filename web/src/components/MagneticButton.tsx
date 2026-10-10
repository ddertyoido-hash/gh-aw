import { useEffect, useRef, type ReactNode } from 'react'
import { gsap } from '../lib/motion'
import { useHasHover } from '../lib/motion'

type MagneticButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'solid' | 'ghost' | 'inline' | 'glow'
  className?: string
  /** Attraction radius beyond the button's own box, in pixels. */
  radius?: number
  /** Show the trailing arrow glyph. */
  withArrow?: boolean
  external?: boolean
  ariaLabel?: string
}

/**
 * A button that leans towards the pointer as it approaches — the magnetic
 * behaviour only exists on hover-capable pointers, so touch keeps a plain,
 * reliable tap target.
 */
export default function MagneticButton({
  children,
  href,
  onClick,
  variant = 'solid',
  className,
  radius = 56,
  withArrow = false,
  external = true,
  ariaLabel,
}: MagneticButtonProps) {
  const root = useRef<HTMLElement | null>(null)
  const label = useRef<HTMLSpanElement | null>(null)
  const hasHover = useHasHover()

  useEffect(() => {
    const el = root.current
    if (!el || !hasHover) return

    const moveX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
    const moveY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })
    const labelX = label.current
      ? gsap.quickTo(label.current, 'x', { duration: 0.6, ease: 'power3.out' })
      : null

    const onPointerMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const centreX = rect.left + rect.width / 2
      const centreY = rect.top + rect.height / 2
      const dx = event.clientX - centreX
      const dy = event.clientY - centreY
      const reach = Math.max(rect.width, rect.height) / 2 + radius

      if (Math.hypot(dx, dy) < reach) {
        moveX(dx * 0.3)
        moveY(dy * 0.34)
        labelX?.(dx * 0.14)
      } else {
        moveX(0)
        moveY(0)
        labelX?.(0)
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      gsap.killTweensOf(el)
      gsap.set(el, { x: 0, y: 0 })
    }
  }, [hasHover, radius])

  const classes = [
    'magnetic',
    `magnetic--${variant}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className="magnetic__label" ref={label}>
        {children}
      </span>
      {withArrow && (
        <span className="magnetic__arrow" aria-hidden="true">
          →
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <a
        ref={root as never}
        className={classes}
        href={href}
        aria-label={ariaLabel}
        {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      ref={root as never}
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  )
}
