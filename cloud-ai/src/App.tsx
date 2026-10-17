/**
 * Cloud AI application root: bootstraps stored data, applies the theme and
 * wallpaper tokens, wires global shortcuts and routes between screens.
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ErrorBanner, LoadingScreen } from './components/common/States'
import { ACCENTS } from './lib/defaults'
import { useRoute } from './lib/router'
import { useHotkeys } from './lib/useHotkeys'
import { useAppStore } from './store/app'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { CreatePage } from './pages/CreatePage'
import { ImagesPage } from './pages/ImagesPage'
import { VoicePage } from './pages/VoicePage'
import { ResearchPage } from './pages/ResearchPage'
import { AgentsPage } from './pages/AgentsPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

const ROUTES: Array<{ path: string; element: ReactNode }> = [
  { path: '/', element: <HomePage /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/images', element: <ImagesPage /> },
  { path: '/voice', element: <VoicePage /> },
  { path: '/research', element: <ResearchPage /> },
  { path: '/agents', element: <AgentsPage /> },
  { path: '/history', element: <HistoryPage /> },
  { path: '/settings', element: <SettingsPage /> },
]

export default function App() {
  const route = useRoute()
  const ready = useAppStore((state) => state.ready)
  const bootError = useAppStore((state) => state.bootError)
  const settings = useAppStore((state) => state.settings)
  const bootstrap = useAppStore((state) => state.bootstrap)

  useHotkeys()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  /* ------------------------------- theming ------------------------------- */
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark)
      root.classList.toggle('dark', dark)
    }
    apply()
    if (settings.theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [settings.theme])

  useEffect(() => {
    const root = document.documentElement
    const accent = ACCENTS.find((candidate) => candidate.id === settings.accent) ?? ACCENTS[0]
    root.style.setProperty('--aurora-cyan', accent.colors[0])
    root.style.setProperty('--aurora-blue', accent.colors[1])
    root.style.setProperty('--aurora-violet', accent.colors[2])
    root.style.setProperty('--aurora-teal', accent.colors[3])
    root.style.setProperty('--glass-alpha', String(settings.glassOpacity / 100))
    root.classList.toggle('reduce-motion', settings.reduceMotion || !settings.animations)

    // Derive the readable ink colours from the chosen theme.
    const dark = root.classList.contains('dark')
    root.style.setProperty('--ink', dark ? '#f1f5f9' : '#0f172a')
    root.style.setProperty('--ink-soft', dark ? '#cbd5e1' : '#334155')
    root.style.setProperty('--ink-muted', dark ? '#94a3b8' : '#64748b')
  }, [settings.accent, settings.glassOpacity, settings.reduceMotion, settings.animations, settings.theme])

  /* ------------------------------- routing ------------------------------- */
  const element = useMemo(() => {
    const match = ROUTES.find((entry) =>
      entry.path === '/' ? route.path === '/' : route.path === entry.path || route.path.startsWith(`${entry.path}/`),
    )
    return match?.element ?? <NotFoundPage />
  }, [route.path])

  if (!ready) {
    return (
      <div className="h-full w-full">
        <LoadingScreen />
      </div>
    )
  }

  return (
    <AppShell>
      {bootError && (
        <div className="px-5 pt-4 sm:px-8">
          <ErrorBanner
            message="Cloud AI started with a problem"
            hint={bootError}
            onRetry={() => void bootstrap()}
            retryLabel="Retry"
          />
        </div>
      )}
      {element}
    </AppShell>
  )
}
