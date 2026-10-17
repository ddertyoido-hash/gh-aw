/**
 * The four premium action cards under the home composer. Each one starts a real
 * flow: the image studio, a writing session, a summarisation prompt or the
 * research workspace.
 */
import { motion } from 'framer-motion'
import { ACTION_CARDS } from '../../lib/defaults'
import { setPendingPrompt } from '../../lib/promptBus'
import { navigate } from '../../lib/router'
import { iconFor } from '../common/icons'
import { cn } from '../../lib/utils'

export function ActionCards() {
  const handle = (cardId: string) => {
    const card = ACTION_CARDS.find((candidate) => candidate.id === cardId)
    if (!card) return
    if (card.id === 'create-image') {
      navigate('/images')
      return
    }
    if (card.id === 'research') {
      setPendingPrompt({ text: '', mode: 'research' })
      navigate('/research')
      return
    }
    setPendingPrompt({ text: card.prompt, mode: card.mode })
    navigate('/')
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ACTION_CARDS.map((card, index) => {
        const Icon = iconFor(card.icon)
        return (
          <motion.button
            key={card.id}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index, type: 'spring', stiffness: 220, damping: 26 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => handle(card.id)}
            className="glass group flex h-full flex-col items-start gap-3 rounded-3xl p-4 text-left transition-shadow hover:shadow-float focus-ring"
          >
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lift transition-transform duration-300 group-hover:scale-105',
                card.accent,
              )}
            >
              <Icon size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold tracking-tight text-ink">{card.label}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-ink-muted">{card.description}</span>
            </span>
            <span className="text-[12px] font-medium text-[color:var(--aurora-blue)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Open →
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
