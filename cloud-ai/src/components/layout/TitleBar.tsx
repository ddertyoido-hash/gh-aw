/**
 * Application title bar: branding, quick search entry, and the window controls
 * that become native in the desktop shell.
 */
import { LayoutGrid, Maximize2, Minus, PanelLeft, PanelRight, Settings2, Square, X, Zap } from 'lucide-react'
import { desktop, isDesktop } from '../../lib/desktop'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { cn } from '../../lib/utils'
import { CloudWordmark } from '../brand/Logo'
import { IconButton } from '../common/Controls'

interface TitleBarProps {
  frameMode: 'windowed' | 'immersed'
  onToggleFrame: () => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  rightPanelOpen: boolean
  onToggleRightPanel: () => void
  centerSubtitle?: string
}

export function TitleBar({
  frameMode,
  onToggleFrame,
  sidebarCollapsed,
  onToggleSidebar,
  rightPanelOpen,
  onToggleRightPanel,
  centerSubtitle,
}: TitleBarProps) {
  const units = useAppStore((state) => state.units)
  const system = useAppStore((state) => state.system)
  const bridge = isDesktop() ? desktop : undefined

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/35 px-3 dark:border-white/10">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <IconButton
          label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleSidebar}
          size="sm"
          className="md:hidden"
        >
          <PanelLeft size={16} />
        </IconButton>
        <CloudWordmark size={30} compact={false} />
        {centerSubtitle && (
          <span className="ml-2 hidden truncate text-[12.5px] text-ink-muted lg:inline">{centerSubtitle}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/')}
        className="glass-subtle mx-2 hidden h-9 max-w-md flex-1 items-center gap-2 rounded-2xl px-3 text-[13px] text-ink-muted transition hover:text-ink focus-ring lg:flex"
        title="Open the home composer (Ctrl/Cmd + K)"
      >
        <LayoutGrid size={15} />
        <span className="flex-1 text-left">Ask Cloud anything, or pick a quick action</span>
        <kbd className="rounded-md border border-white/50 bg-white/60 px-1.5 py-0.5 text-[11px] dark:border-white/15 dark:bg-white/10">
          ⌘K
        </kbd>
      </button>

      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          title="Plan and AI units"
          className={cn(
            'glass-subtle hidden items-center gap-2 rounded-2xl px-3 py-1.5 text-[12.5px] transition hover:text-ink sm:flex',
            'text-ink-soft focus-ring',
          )}
        >
          <Zap size={14} className="text-[color:var(--aurora-blue)]" />
          <span className="font-medium tabular-nums">{units?.remaining ?? '–'}</span>
          <span className="text-ink-muted">units</span>
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium capitalize dark:bg-white/10">
            {units?.plan ?? 'free'}
          </span>
        </button>

        <IconButton
          label={rightPanelOpen ? 'Hide insights panel' : 'Show insights panel'}
          onClick={onToggleRightPanel}
          size="sm"
        >
          <PanelRight size={16} />
        </IconButton>

        <IconButton
          label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleSidebar}
          size="sm"
          className="hidden md:inline-flex"
        >
          <PanelLeft size={16} />
        </IconButton>

        <div className="ml-1 flex items-center gap-1 rounded-2xl border border-white/40 bg-white/35 p-1 dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            onClick={() => (bridge ? bridge.window.minimize() : onToggleFrame())}
            aria-label={bridge ? 'Minimize window' : 'Compact window'}
            title={bridge ? 'Minimize' : 'Compact window'}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/70 hover:text-ink focus-ring dark:hover:bg-white/15"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => (bridge ? bridge.window.toggleMaximize() : onToggleFrame())}
            aria-label={bridge ? 'Maximize window' : 'Expand window'}
            title={bridge ? 'Maximize' : frameMode === 'immersed' ? 'Return to windowed' : 'Expand window'}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/70 hover:text-ink focus-ring dark:hover:bg-white/15"
          >
            {frameMode === 'immersed' && !bridge ? <Maximize2 size={13} /> : <Square size={12} />}
          </button>
          {bridge && (
            <button
              type="button"
              onClick={() => bridge.window.close()}
              aria-label="Close window"
              title="Close"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-500/15 focus-ring"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Hidden but reachable: the title bar reports which runtime is active. */}
      <span className="sr-only">Running {system?.runtime.platform ?? 'web'} build</span>
      <span className="sr-only">
        <Settings2 size={12} />
      </span>
    </header>
  )
}
