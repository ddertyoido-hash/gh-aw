/**
 * Media query + reduced motion hooks used by the responsive shell.
 */
import { useEffect, useState } from 'react'
import { useAppStore } from '../store/app'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export interface LayoutTier {
  width: number
  /** Full three-column layout with labels. */
  wide: boolean
  /** Icon rail + optional right panel. */
  compact: boolean
  /** Narrow: overlays instead of columns. */
  narrow: boolean
  /** Honour the OS setting or the in-app preference. */
  reduceMotion: boolean
}

export function useLayoutTier(): LayoutTier {
  const width = useViewportWidth()
  const preferredReduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const settings = useAppStore((state) => state.settings)

  return {
    width,
    wide: width >= 1360,
    compact: width >= 1080 && width < 1360,
    narrow: width < 1080,
    reduceMotion: preferredReduced || settings.reduceMotion || !settings.animations,
  }
}

export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}
