/**
 * Plans, unit costs and usage accounting.
 *
 * All balances are computed and mutated on the server - the client only ever
 * displays what the API reports, so a tampered frontend cannot grant itself
 * AI units.
 */
import { db, getSetting, newId, nowIso, setSetting } from './db.js'

export interface Plan {
  id: 'free' | 'pro'
  name: string
  priceMonthly: number
  priceYearly: number
  units: number
  tagline: string
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    units: 60,
    tagline: 'Everything you need to try Cloud AI every day.',
    features: [
      '60 AI units every month',
      'Chat with fast and balanced models',
      'Voice input and speech playback',
      '4 built-in agents',
      'Image generation at standard quality',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 12,
    priceYearly: 120,
    units: 1500,
    tagline: 'For daily creative and research work.',
    features: [
      '1,500 AI units every month',
      'All powerful and vision models',
      'High quality image generation',
      'Custom agents with tools',
      'Long conversation memory and history export',
      'Priority streaming',
    ],
  },
]

/** Unit price of each operation, in AI units. */
export const COSTS = {
  chat: 1,
  summarize: 2,
  research: 3,
  image: 5,
  voice: 1,
} as const

export type CostKind = keyof typeof COSTS

export interface PlanState {
  plan: 'free' | 'pro'
  cycle: 'monthly' | 'yearly'
  period: string
  granted: number
  remaining: number
  spent: number
  renewsAt: string
}

const periodKey = (date = new Date()) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const periodEnd = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString()

function planUnits(planId: string): number {
  return PLANS.find((p) => p.id === planId)?.units ?? PLANS[0].units
}

/**
 * Grants the monthly unit allowance when a new period starts. Safe to call on
 * every read - it is a no-op inside the current period.
 */
export function syncPeriod(): PlanState {
  const plan = getSetting<'free' | 'pro'>('plan', 'free')
  const cycle = getSetting<'monthly' | 'yearly'>('planCycle', 'monthly')
  const stored = getSetting<{ period: string; granted: number; remaining: number } | null>(
    'units',
    null,
  )
  const current = periodKey()

  if (!stored || stored.period !== current || stored.granted !== planUnits(plan)) {
    const granted = planUnits(plan)
    setSetting('units', { period: current, granted, remaining: granted })
    return {
      plan,
      cycle,
      period: current,
      granted,
      remaining: granted,
      spent: 0,
      renewsAt: periodEnd(),
    }
  }

  const spent = db
    .prepare('SELECT COALESCE(SUM(units), 0) AS units FROM usage WHERE ts >= ?')
    .get(periodStartIso()) as { units: number }

  return {
    plan,
    cycle,
    period: current,
    granted: stored.granted,
    remaining: Math.max(0, stored.remaining),
    spent: spent.units,
    renewsAt: periodEnd(),
  }
}

function periodStartIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export function assertAffordable(kind: CostKind): void {
  const state = syncPeriod()
  const cost = COSTS[kind]
  if (state.remaining < cost) {
    throw Object.assign(new Error('Not enough AI units remaining'), {
      status: 402,
      code: 'insufficient_units',
      hint: `This action costs ${cost} AI units and ${state.remaining} remain. Upgrade your plan or wait for the monthly renewal.`,
    })
  }
}

export function chargeUnits(
  kind: CostKind,
  label: string,
  model: string | null,
  refId: string | null,
): number {
  const cost = COSTS[kind]
  const state = syncPeriod()
  const remaining = Math.max(0, state.remaining - cost)
  setSetting('units', { period: state.period, granted: state.granted, remaining })
  db.prepare('INSERT INTO usage (id, ts, kind, label, model, units, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    newId(),
    nowIso(),
    kind,
    label,
    model,
    cost,
    refId,
  )
  return remaining
}

export function usageHistory(limit = 60) {
  return db
    .prepare('SELECT * FROM usage WHERE ts >= ? ORDER BY ts DESC LIMIT ?')
    .all(periodStartIso(), limit) as Array<{
    id: string
    ts: string
    kind: string
    label: string
    model: string | null
    units: number
    ref_id: string | null
  }>
}

export function setPlan(plan: 'free' | 'pro', cycle: 'monthly' | 'yearly'): PlanState {
  setSetting('plan', plan)
  setSetting('planCycle', cycle)
  // force a fresh grant for the new plan in the current period
  setSetting('units', { period: 'reset', granted: 0, remaining: 0 })
  return syncPeriod()
}
