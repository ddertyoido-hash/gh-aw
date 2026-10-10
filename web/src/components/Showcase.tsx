import { useEffect, useRef } from 'react'
import { gsap, useHasHover } from '../lib/motion'
import { showcase } from '../data/content'
import MagneticButton from './MagneticButton'
import MaterialVisual from './MaterialVisual'
import Reveal from './Reveal'

type Card = (typeof showcase.cards)[number]

function ShowcaseCard({ card }: { card: Card }) {
  const root = useRef<HTMLElement | null>(null)
  const hasHover = useHasHover()

  useEffect(() => {
    const el = root.current
    if (!el || !hasHover) return

    gsap.set(el, { transformPerspective: 1100, transformOrigin: 'center' })
    const rotateX = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3.out' })
    const rotateY = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3.out' })

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      rotateY(px * 13)
      rotateX(-py * 13)
      // Drives the border highlight in CSS.
      el.style.setProperty('--mx', `${(px + 0.5) * 100}%`)
      el.style.setProperty('--my', `${(py + 0.5) * 100}%`)
    }

    const onLeave = () => {
      rotateX(0)
      rotateY(0)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      gsap.killTweensOf(el)
    }
  }, [hasHover])

  return (
    <article className="card" ref={root as never}>
      <div className="card__visual">
        <MaterialVisual variant={card.visual} />
      </div>
      <div className="card__body">
        <p className="card__tag">{card.tag}</p>
        <h3 className="card__title">{card.title}</h3>
        <p className="card__text">{card.body}</p>
        <MagneticButton variant="inline" href={card.href} withArrow>
          {card.linkLabel}
        </MagneticButton>
      </div>
    </article>
  )
}

/** A 3-up tactile grid: the whole board leans towards the cursor. */
export default function Showcase() {
  const board = useRef<HTMLDivElement | null>(null)
  const hasHover = useHasHover()

  useEffect(() => {
    const el = board.current
    if (!el || !hasHover) return

    const xTo = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' })

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const px = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width - 0.5))
      const py = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height - 0.5))
      xTo(px * 26)
      yTo(py * 18)
    }

    const onLeave = () => {
      xTo(0)
      yTo(0)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      gsap.killTweensOf(el)
    }
  }, [hasHover])

  return (
    <section className="showcase" id="showcase" aria-label="Showcase">
      <div className="showcase__head">
        <Reveal as="p" className="eyebrow" text={showcase.eyebrow} />
        <Reveal as="h2" className="showcase__title" text={showcase.title} stagger={0.05} />
        <Reveal as="p" className="showcase__lede" text={showcase.body} stagger={0.016} />
      </div>

      <div className="showcase__board" ref={board} data-hover={hasHover ? 'true' : 'false'}>
        {showcase.cards.map((card) => (
          <ShowcaseCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  )
}
