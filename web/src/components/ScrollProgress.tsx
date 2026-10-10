import { useEffect, useRef } from 'react'

/** Hairline progress rail pinned to the very top of the viewport. */
export default function ScrollProgress() {
  const bar = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = bar.current
    if (!el) return
    let frame = 0

    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      el.style.transform = `scaleX(${progress})`
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="progress" aria-hidden="true">
      <div className="progress__bar" ref={bar} />
    </div>
  )
}
