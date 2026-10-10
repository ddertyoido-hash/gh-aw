import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './motion'

/**
 * Smooth, natural scrolling that keeps the browser's own scroll position in
 * charge: the scrollbar, keyboard paging, anchors and native touch scrolling
 * all keep working. Lenis only eases wheel/trackpad input.
 *
 * Disabled entirely when the visitor prefers reduced motion.
 */
export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      smoothWheel: true,
      // Native touch scrolling feels better and avoids hijacking gestures.
      syncTouch: false,
    })

    const onScroll = () => ScrollTrigger.update()
    lenis.on('scroll', onScroll)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // Anchor links keep working, just eased.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href^="#"]')
      if (!anchor) return
      const id = anchor.getAttribute('href')
      if (!id || id === '#') return
      const target = document.querySelector(id)
      if (!target) return
      event.preventDefault()
      lenis.scrollTo(target as HTMLElement, { offset: 0, duration: 1.1 })
    }
    document.addEventListener('click', onClick)

    // Fonts and images change layout; re-measure once they settle.
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => ScrollTrigger.refresh())
    }
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)

    return () => {
      window.removeEventListener('load', refresh)
      document.removeEventListener('click', onClick)
      gsap.ticker.remove(raf)
      lenis.off('scroll', onScroll)
      lenis.destroy()
    }
  }, [enabled])
}
