import { useEffect, useRef } from 'react'
import { MOTION_OK, gsap, useParallax } from '../lib/motion'
import { features } from '../data/content'
import MagneticButton from './MagneticButton'
import MaterialVisual from './MaterialVisual'
import Reveal from './Reveal'

type Feature = (typeof features)[number]

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const visual = useRef<HTMLDivElement | null>(null)
  const inner = useRef<HTMLDivElement | null>(null)
  const tone = index % 2 === 0 ? 'dark' : 'light'

  // The visual drifts against the copy as the row crosses the viewport.
  useParallax(visual, index % 2 === 0 ? 72 : 48)

  // …and resolves from a slight scale and haze as it arrives.
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const tween = gsap.fromTo(
        el,
        { scale: 0.93, opacity: 0.5 },
        {
          scale: 1,
          opacity: 1,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 45%', scrub: true },
        },
      )
      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
      }
    })
    return () => mm.revert()
  }, [])

  return (
    <article className={`feature feature--${tone}${index % 2 === 1 ? ' feature--flip' : ''}`}>
      <div className="feature__copy">
        <Reveal as="p" className="eyebrow" text={feature.eyebrow} />
        <Reveal as="h2" className="feature__title" text={feature.title} stagger={0.055} />
        <Reveal
          as="p"
          className="feature__body"
          text={feature.body}
          stagger={0.014}
          duration={0.75}
        />
        <div className="feature__action">
          <MagneticButton variant="inline" href={feature.link.href} withArrow>
            {feature.link.label}
          </MagneticButton>
        </div>
      </div>

      <div className="feature__visual" ref={visual}>
        <div className="feature__visualInner" ref={inner}>
          <MaterialVisual variant={feature.visual} />
        </div>
      </div>
    </article>
  )
}

/** Three feature chapters, alternating dark and light so the page reads as a
 * series of shutters. */
export default function Features() {
  return (
    <section className="features" aria-label="Capabilities">
      {features.map((feature, index) => (
        <FeatureRow key={feature.title} feature={feature} index={index} />
      ))}
    </section>
  )
}
