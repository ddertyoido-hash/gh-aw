/**
 * Global keyboard shortcuts plus the small event bus the composer listens to.
 *
 * Combinations are checked against the platform modifier (Cmd on macOS, Ctrl
 * elsewhere) and never fire while the user is typing in a field, except for the
 * ones that are meant to interrupt typing (Escape, new chat, open settings).
 */
import { useEffect } from 'react'
import { navigate } from './router'

const FOCUS_COMPOSER_EVENT = 'cloud-ai:focus-composer'
const STOP_GENERATION_EVENT = 'cloud-ai:stop-generation'

export const focusComposer = () => window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT))
export const requestStopGeneration = () => window.dispatchEvent(new Event(STOP_GENERATION_EVENT))

export const onFocusComposer = (handler: () => void) => {
  window.addEventListener(FOCUS_COMPOSER_EVENT, handler)
  return () => window.removeEventListener(FOCUS_COMPOSER_EVENT, handler)
}

export const onStopGeneration = (handler: () => void) => {
  window.addEventListener(STOP_GENERATION_EVENT, handler)
  return () => window.removeEventListener(STOP_GENERATION_EVENT, handler)
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || element.isContentEditable
}

export function useHotkeys(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      const typing = isTypingTarget(event.target)

      if (event.key === 'Escape') {
        requestStopGeneration()
        const active = document.activeElement as HTMLElement | null
        active?.blur()
        return
      }

      if (!modifier) return

      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        window.dispatchEvent(new Event('cloud-ai:new-chat'))
        navigate('/chat')
        return
      }
      if (key === 'k') {
        event.preventDefault()
        navigate('/')
        setTimeout(focusComposer, 60)
        return
      }
      if (key === ',' || event.code === 'Comma') {
        event.preventDefault()
        navigate('/settings')
        return
      }
      if (key === 'b') {
        event.preventDefault()
        window.dispatchEvent(new Event('cloud-ai:toggle-sidebar'))
        return
      }
      if (event.shiftKey && key === 'i') {
        event.preventDefault()
        navigate('/images')
        return
      }
      if (event.shiftKey && key === 's') {
        event.preventDefault()
        requestStopGeneration()
        return
      }
      if (typing) return
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
