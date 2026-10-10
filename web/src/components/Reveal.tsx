import { useLayoutEffect, useMemo, useRef, type ElementType } from 'react'
import { gsap, MOTION_OK } from '../lib/motion'

type RevealMode = 'words' | 'chars' | 'lines'

type RevealProps = {
  text: string
  as?: ElementType
  mode?: RevealMode
  className?: string
  id?: string
  /** Seconds before the stagger starts. */
  delay?: number
  /** Seconds between tokens. */
  stagger?: number
  /** ScrollTrigger start position. */
  start?: string
  /** Skip the scroll trigger and play immediately (hero use). */
  immediate?: boolean
  duration?: number
}

/**
 * Splits a line of copy into masks + tokens and slides them up on scroll.
 * The full string stays available to assistive tech through aria-label, so the
 * visual split never harms screen-reader output. Reduced motion keeps the copy
 * static and simply fades the block in.
 */
export default function Reveal({
  text,
  as: Tag = 'p',
  mode = 'words',
  className,
  id,
  delay = 0,
  stagger,
  start = 'top 85%',
  immediate = false,
  duration = 1.05,
}: RevealProps) {
  const root = useRef<HTMLElement | null>(null)

  const tokens = useMemo(() => {
    if (mode === 'lines') return text.split('\n')
    return text.split(' ').filter((token) => token.length > 0)
  }, [text, mode])

  const step = stagger ?? (mode === 'chars' ? 0.022 : 0.07)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const words = el.querySelectorAll('.reveal__word')
    if (!words.length) return

    const mm = gsap.matchMedia()

    mm.add(MOTION_OK, () => {
      gsap.set(words, { yPercent: 118, opacity: 0 })
      const tween = gsap.to(words, {
        yPercent: 0,
        opacity: 1,
        duration,
        ease: 'expo.out',
        stagger: step,
        delay,
        scrollTrigger: immediate ? undefined : { trigger: el, start, once: true },
      })
      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    })

    // Reduced motion: a plain, quiet fade.
    mm.add(
      '(prefers-reduced-motion: reduce)',
      () => {
        const tween = gsap.fromTo(
          el,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.5,
            delay,
            scrollTrigger: immediate ? undefined : { trigger: el, start, once: true },
          },
        )
        return () => {
          tween.scrollTrigger?.kill()
          tween.kill()
        }
      },
      root,
    )

    return () => mm.revert()
  }, [text, mode, delay, step, start, immediate, duration])

  const isLines = mode === 'lines'

  // ElementType keeps the API flexible (h1/h2/h3/p/a); the cast keeps JSX happy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = Tag as any

  return (
    <Component
      ref={root}
      id={id}
      className={`reveal${isLines ? ' reveal--lines' : ''}${className ? ` ${className}` : ''}`}
      aria-label={text}
    >
      <span className="reveal__inner" aria-hidden="true">
        {tokens.map((token, index) => {
          const isLast = index === tokens.length - 1
          return (
            <span className="reveal__unit" key={`${token}-${index}`}>
              <span className="reveal__mask">
                {mode === 'chars' ? (
                  Array.from(token).map((char, charIndex) => (
                    <span className="reveal__word" key={charIndex}>
                      {char}
                    </span>
                  ))
                ) : (
                  <span className="reveal__word">{token}</span>
                )}
              </span>
              {isLines || isLast ? null : ' '}
            </span>
          )
        })}
      </span>
    </Component>
  )
}
