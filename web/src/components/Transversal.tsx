import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from '../lib/motion'
import { transversal } from '../data/content'
import MaterialVisual from './MaterialVisual'
import Reveal from './Reveal'

/** A single masked line inside a panel. */
function Line({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`panel__line${className ? ` ${className}` : ''}`}>
      <span className="panel__reveal">{children}</span>
    </span>
  )
}

/**
 * The Transversal — a pinned horizontal narrative. Vertical scroll is mapped to
 * horizontal travel through three cinematic voids; on narrow screens and for
 * reduced motion the panels simply stack vertically.
 */
export default function Transversal() {
  const wrap = useRef<HTMLDivElement | null>(null)
  const track = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const wrapEl = wrap.current
    const trackEl = track.current
    if (!wrapEl || !trackEl) return

    const mm = gsap.matchMedia()

    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      const panels = gsap.utils.toArray<HTMLElement>('.panel', trackEl)

      // Measure the stage rather than 100vw, so the last panel finishes flush
      // against the right edge instead of over-travelling by a scrollbar.
      const applyPanelWidth = () => {
        trackEl.style.setProperty('--panel-w', `${wrapEl.clientWidth}px`)
      }
      const distance = () => Math.max(0, (panels.length - 1) * wrapEl.clientWidth)

      applyPanelWidth()

      const tween = gsap.to(trackEl, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrapEl,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: applyPanelWidth,
        },
      })

      const inner = panels.flatMap((panel) => {
        const masked = panel.querySelectorAll('.panel__reveal')
        const faded = panel.querySelectorAll('.panel__fade')
        const tweens = [
          gsap.fromTo(
            masked,
            { yPercent: 112, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.9,
              ease: 'expo.out',
              stagger: 0.07,
              scrollTrigger: {
                trigger: panel,
                containerAnimation: tween,
                start: 'left 78%',
                once: true,
              },
            },
          ),
          gsap.fromTo(
            faded,
            { y: 34, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.9,
              ease: 'expo.out',
              stagger: 0.08,
              delay: 0.15,
              scrollTrigger: {
                trigger: panel,
                containerAnimation: tween,
                start: 'left 78%',
                once: true,
              },
            },
          ),
        ]
        return tweens
      })

      return () => {
        inner.forEach((item) => {
          item.scrollTrigger?.kill()
          item.kill()
        })
        tween.scrollTrigger?.kill()
        tween.kill()
        gsap.set(trackEl, { clearProps: 'transform' })
      }
    })

    // Narrow screens and reduced motion: nothing is pinned or hidden.
    mm.add('(max-width: 899px), (prefers-reduced-motion: reduce)', () => {
      gsap.set(trackEl, { clearProps: 'transform' })
      gsap.set(trackEl.querySelectorAll('.panel__reveal, .panel__fade'), {
        yPercent: 0,
        y: 0,
        opacity: 1,
      })
    })

    return () => mm.revert()
  }, [])

  return (
    <section className="transversal" id="how-it-works" aria-label="How it works">
      <div className="transversal__pin" ref={wrap}>
        <div className="transversal__head">
          <Reveal as="p" className="eyebrow" text={transversal.eyebrow} />
          <Reveal
            as="h2"
            className="transversal__title"
            text={transversal.title}
            stagger={0.05}
          />
        </div>

        <div className="transversal__track" ref={track}>
          {transversal.panels.map((panel) => (
            <article className="panel" key={panel.index}>
              <div className="panel__copy">
                <Line className="panel__index">{panel.index}</Line>
                <h3 className="panel__title">
                  <Line>{panel.title}</Line>
                </h3>
                <p className="panel__body panel__fade">{panel.body}</p>
                <Line className="panel__meta">{panel.meta}</Line>
              </div>
              <div className="panel__visual">
                <MaterialVisual variant={panel.visual} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
