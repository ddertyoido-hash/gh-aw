import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { ScrollTrigger, gsap, MOTION_OK, useHasHover, useInView, useMediaQuery } from '../lib/motion'
import { hero, site } from '../data/content'
import MagneticButton from './MagneticButton'
import SceneBoundary from './SceneBoundary'

const HeroScene = lazy(() => import('../three/HeroScene'))

/**
 * The Nexus — full-bleed black stage, the headline splitting to the viewport
 * edges around a floating chrome monolith.
 */
export default function Hero() {
  const section = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLDivElement | null>(null)
  const object = useRef<HTMLDivElement | null>(null)

  const pointer = useRef({ x: 0, y: 0 })
  const scrollProgress = useRef(0)

  const hasHover = useHasHover()
  const small = useMediaQuery('(max-width: 820px)')
  const near = useInView(section, '200px')
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  // The 3D scene is created only after the hero has painted.
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 120)
    return () => window.clearTimeout(id)
  }, [])

  // Track real viewport visibility so the canvas can stop rendering off-screen.
  useEffect(() => {
    const el = section.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!hasHover) return
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [hasHover])

  // Scroll progress feeds the 3D object and fades the copy away.
  useEffect(() => {
    const el = section.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => {
          scrollProgress.current = self.progress
        },
      })
      const fade = gsap.to(content.current, {
        opacity: 0,
        y: -70,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: '70% top', scrub: true },
      })
      return () => {
        trigger.kill()
        fade.scrollTrigger?.kill()
        fade.kill()
      }
    })
    return () => mm.revert()
  }, [])

  // Staggered entrance: nav, then the split headline, then the object and copy.
  useEffect(() => {
    const el = section.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const timeline = gsap.timeline({ defaults: { ease: 'expo.out' } })
      timeline
        .from('.hero__eyebrow', { y: 22, opacity: 0, duration: 0.9 }, 0.2)
        .from(
          '.hero__word--a',
          { opacity: 0, xPercent: 20, filter: 'blur(12px)', duration: 1.5 },
          0.3,
        )
        .from(
          '.hero__word--b',
          { opacity: 0, xPercent: -20, filter: 'blur(12px)', duration: 1.5 },
          0.42,
        )
        .from('.hero__object', { opacity: 0, scale: 0.84, duration: 1.8 }, 0.25)
        .from('.hero__lede', { y: 26, opacity: 0, duration: 1 }, 0.95)
        .from('.hero__actions', { y: 22, opacity: 0, duration: 0.9 }, 1.1)
        .from('.hero__hint', { opacity: 0, duration: 0.9 }, 1.3)
      return () => timeline.kill()
    })
    return () => mm.revert()
  }, [])

  return (
    <section className="hero" id="top" ref={section} aria-labelledby="hero-title">
      <div className="hero__grid" aria-hidden="true" />

      <div className="hero__object" ref={object}>
        <div className="hero__objectGlow" aria-hidden="true" />
        {mounted && near && (
          <SceneBoundary>
            <Suspense fallback={null}>
              <HeroScene
                pointer={pointer}
                scroll={scrollProgress}
                active={visible}
                lite={small}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>

      <div className="hero__content" ref={content}>
        <p className="hero__eyebrow eyebrow">{hero.eyebrow}</p>

        <h1 className="hero__title" id="hero-title">
          <span className="sr-only">{site.name}</span>
          <span className="hero__word hero__word--a" aria-hidden="true">
            {hero.words[0]}
          </span>
          <span className="hero__word hero__word--b" aria-hidden="true">
            {hero.words[1]}
          </span>
        </h1>

        <div className="hero__bottom">
          <p className="hero__lede">{hero.lede}</p>
          <div className="hero__actions">
            <MagneticButton href={hero.primary.href} variant="solid" withArrow>
              {hero.primary.label}
            </MagneticButton>
            <MagneticButton href={hero.secondary.href} variant="ghost">
              {hero.secondary.label}
            </MagneticButton>
          </div>
        </div>
      </div>

      <div className="hero__hint" aria-hidden="true">
        <span className="hero__hintLabel">{hero.scrollHint}</span>
        <span className="hero__hintLine" />
      </div>
    </section>
  )
}
