import { useRef, useState } from 'react'
import { closing, site } from '../data/content'
import MagneticButton from './MagneticButton'
import Reveal from './Reveal'

/**
 * Finality — the page inverts to light and the headline runs full-bleed. The
 * primary action is real: it copies the install command to the clipboard.
 */
export default function Closing() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  const copyCommand = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(closing.command)
      } else {
        const area = document.createElement('textarea')
        area.value = closing.command
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      }
      setCopied(true)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="closing" id="start" aria-labelledby="closing-title">
      <div className="closing__bleed" aria-hidden="true" />
      <div className="closing__glow" aria-hidden="true" />

      <div className="closing__inner">
        <Reveal as="p" className="eyebrow eyebrow--dark" text="Get started" />

        <Reveal
          as="h2"
          id="closing-title"
          className="closing__title"
          mode="lines"
          text={closing.headline.join('\n')}
          stagger={0.1}
          duration={1.2}
        />

        <Reveal as="p" className="closing__lede" text={closing.lede} stagger={0.02} />

        <div className="closing__actions">
          <MagneticButton
            variant="glow"
            onClick={copyCommand}
            radius={72}
            ariaLabel={`${closing.copyLabel}: ${site.command}`}
          >
            {copied ? closing.copiedLabel : closing.copyLabel}
          </MagneticButton>
          <MagneticButton variant="ghost" className="magnetic--onLight" href={closing.secondary.href}>
            {closing.secondary.label}
          </MagneticButton>
        </div>

        <p className="closing__command">
          <code>{site.command}</code>
        </p>

        <span className="sr-only" role="status" aria-live="polite">
          {copied ? closing.copiedLabel : ''}
        </span>
      </div>
    </section>
  )
}
