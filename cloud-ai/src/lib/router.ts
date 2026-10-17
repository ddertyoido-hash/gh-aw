/**
 * Hash router.
 *
 * Cloud AI uses hash routing because the packaged desktop shell loads the UI
 * from disk, where path-based routing is not available. URLs still look like
 * `#/settings?billing=success`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

export interface RouteMatch {
  path: string
  query: URLSearchParams
  hash: string
}

function parse(location: Location): RouteMatch {
  const raw = location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return {
    path: path.startsWith('/') ? path : `/${path}`,
    query: new URLSearchParams(search),
    hash: location.hash,
  }
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const target = to.startsWith('/') ? `#${to}` : `#/${to}`
  if (options.replace) {
    window.history.replaceState(null, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

export function useRoute(): RouteMatch {
  const [route, setRoute] = useState<RouteMatch>(() => parse(window.location))

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** True when the current path equals or nests under `path`. */
export function useIsActive(path: string): boolean {
  const route = useRoute()
  return useMemo(() => {
    if (path === '/') return route.path === '/'
    return route.path === path || route.path.startsWith(`${path}/`)
  }, [path, route.path])
}

export function useNavigate() {
  return useCallback((to: string, options?: { replace?: boolean }) => navigate(to, options), [])
}
