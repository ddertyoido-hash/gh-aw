import { useEffect, useRef, useState } from 'react'
import { gsap, MOTION_OK } from '../lib/motion'
import { links, nav, site } from '../data/content'

/** Minimal fixed navigation: wordmark, section anchors, one real action. */
export default function Nav() {
  const root = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const tween = gsap.fromTo(
        el,
        { yPercent: -120, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1, delay: 0.15, ease: 'expo.out' },
      )
      return () => tween.kill()
    })
    return () => mm.revert()
  }, [])

  // Keep the menu dismissal simple: Escape closes, and following a link closes.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="nav" ref={root as never} data-open={open ? 'true' : 'false'}>
      <a className="nav__brand" href="#top" aria-label={`${site.name} — back to top`}>
        <span className="nav__mark">{site.shortName}</span>
        <span className="nav__name">{site.name}</span>
      </a>

      <nav className="nav__links" aria-label="Sections">
        {nav.map((item) => (
          <a key={item.href} className="nav__link" href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <a className="nav__cta" href={links.quickstart} target="_blank" rel="noreferrer noopener">
        Install
      </a>

      <button
        type="button"
        className="nav__toggle"
        aria-expanded={open}
        aria-controls="nav-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nav__toggle-bar" />
        <span className="nav__toggle-bar" />
      </button>

      <div className="nav__menu" id="nav-menu" hidden={!open}>
        {nav.map((item) => (
          <a
            key={item.href}
            className="nav__menu-link"
            href={item.href}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </a>
        ))}
        <a
          className="nav__menu-link nav__menu-link--cta"
          href={links.quickstart}
          target="_blank"
          rel="noreferrer noopener"
          onClick={() => setOpen(false)}
        >
          Install the extension
        </a>
      </div>
    </header>
  )
}
