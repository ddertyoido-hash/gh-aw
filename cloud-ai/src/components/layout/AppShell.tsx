/**
 * Application shell.
 *
 * Renders the floating glass window over the nature wallpaper with the
 * three-column layout: sidebar, workspace, insights panel - plus the dock. The
 * layout adapts to the window: full columns when wide, an icon rail in compact
 * windows, and overlay drawers when narrow.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { useLayoutTier } from '../../lib/useMediaQuery'
import { navigate } from '../../lib/router'
import { cn } from '../../lib/utils'
import { Wallpaper } from '../brand/Wallpaper'
import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'
import { TitleBar } from './TitleBar'
import { Dock } from './Dock'
import { Toasts } from '../common/Toasts'
import { IconButton } from '../common/Controls'

export function AppShell({ children }: { children: ReactNode }) {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const tier = useLayoutTier()

  const [frameMode, setFrameMode] = useState<'windowed' | 'immersed'>('windowed')
  const [sidebarDrawer, setSidebarDrawer] = useState(false)
  const [rightDrawer, setRightDrawer] = useState(false)

  const sidebarCollapsed = settings.sidebarCollapsed || tier.compact
  const rightPanelVisible = !settings.rightPanelCollapsed && (tier.wide || (tier.compact && tier.width >= 1180))

  // Global shell events (Ctrl/Cmd+B, new chat).
  useEffect(() => {
    const onToggleSidebar = () => void saveSettings({ sidebarCollapsed: !settings.sidebarCollapsed })
    const onNewChat = () => {
      useChatStore.getState().startNew({})
      navigate('/chat')
    }
    window.addEventListener('cloud-ai:toggle-sidebar', onToggleSidebar)
    window.addEventListener('cloud-ai:new-chat', onNewChat)
    return () => {
      window.removeEventListener('cloud-ai:toggle-sidebar', onToggleSidebar)
      window.removeEventListener('cloud-ai:new-chat', onNewChat)
    }
  }, [saveSettings, settings.sidebarCollapsed])

  const showRightPanel = () => {
    if (tier.wide || tier.compact) void saveSettings({ rightPanelCollapsed: !settings.rightPanelCollapsed })
    else setRightDrawer(true)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Wallpaper wallpaper={settings.wallpaper} dim={settings.wallpaperDim} animate={!tier.reduceMotion} />

      <div
        className={cn(
          'relative z-10 flex h-full w-full flex-col transition-[padding] duration-300',
          frameMode === 'windowed' ? 'p-2 sm:p-3 lg:p-5' : 'p-0',
        )}
      >
        <motion.div
          layout
          className={cn(
            'glass relative flex min-h-0 flex-1 flex-col overflow-hidden',
            frameMode === 'windowed' ? 'rounded-window' : 'rounded-none',
          )}
        >
          <TitleBar
            frameMode={frameMode}
            onToggleFrame={() => setFrameMode((current) => (current === 'windowed' ? 'immersed' : 'windowed'))}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => {
              if (tier.narrow) setSidebarDrawer(true)
              else void saveSettings({ sidebarCollapsed: !settings.sidebarCollapsed })
            }}
            rightPanelOpen={tier.narrow ? rightDrawer : !settings.rightPanelCollapsed}
            onToggleRightPanel={() => {
              if (rightDrawer) setRightDrawer(false)
              else showRightPanel()
            }}
            centerSubtitle={settings.profileName}
          />

          <div className="flex min-h-0 flex-1">
            <div className="hidden md:flex">
              <Sidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => void saveSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
              />
            </div>

            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>

            {rightPanelVisible && (
              <div className="hidden md:flex">
                <RightPanel />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <Dock />
      <Toasts />

      {/* ------------------------- narrow-window drawers ------------------------- */}
      <AnimatePresence>
        {sidebarDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden"
              onClick={() => setSidebarDrawer(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="fixed left-0 top-0 z-50 h-full md:hidden"
            >
              <div className="glass-strong h-full">
                <Sidebar collapsed={false} onToggleCollapse={() => setSidebarDrawer(false)} onNavigate={() => setSidebarDrawer(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rightDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden"
              onClick={() => setRightDrawer(false)}
            />
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 340 }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="glass-strong fixed right-0 top-0 z-50 h-full md:hidden"
            >
              <RightPanel onClose={() => setRightDrawer(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* In narrow windows the sidebar lives in a drawer, so give it a handle. */}
      <div className="fixed left-3 top-3 z-30 md:hidden">
        <IconButton
          label="Open navigation"
          size="sm"
          variant="glass"
          onClick={() => setSidebarDrawer(true)}
          className="glass-strong"
        >
          <Menu size={16} />
        </IconButton>
      </div>
    </div>
  )
}
