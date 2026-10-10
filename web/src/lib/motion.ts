import { useEffect, useRef, useState, type RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

/** Media queries used to gate animation work. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)'
export const MOTION_REDUCED = '(prefers-reduced-motion: reduce)'

/** True when the visitor asked for reduced motion (live-updating). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true
    return window.matchMedia(MOTION_REDUCED).matches
  })

  useEffect(() => {
    const query = window.matchMedia(MOTION_REDUCED)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** True once the element is within `rootMargin` of the viewport. */
export function useInView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  rootMargin = '300px',
): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setInView(true)
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  return inView
}

/** Reactive media query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Live viewport visibility — flips back to false when the element leaves. */
export function useOnScreen<T extends HTMLElement>(ref: RefObject<T | null>): boolean {
  const [onScreen, setOnScreen] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return onScreen
}

/** Coarse pointer / no-hover devices get touch behaviour instead of hover. */
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  })

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onChange = () => setHasHover(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return hasHover
}

/** Tracks a normalised scroll progress (0 → 1) for a section. */
export function useSectionProgress(ref: RefObject<HTMLElement | null>): RefObject<number> {
  const progress = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          progress.current = self.progress
        },
      })
      return () => trigger.kill()
    })
    return () => mm.revert()
  }, [ref])

  return progress
}

/** Gently drifts a layer as it crosses the viewport. */
export function useParallax(
  ref: RefObject<HTMLElement | null>,
  strength = 60,
  enabled = true,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const tween = gsap.fromTo(
        el,
        { y: strength },
        {
          y: -strength,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    })
    return () => mm.revert()
  }, [ref, strength, enabled])
}
