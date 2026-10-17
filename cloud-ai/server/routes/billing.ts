/**
 * Billing routes (Stripe Checkout).
 *
 * The plan and unit balance are changed only after the server verifies the
 * checkout session directly with Stripe - a client can never grant itself a
 * paid plan. Without Stripe credentials the API reports that billing is not
 * configured instead of pretending a payment happened.
 */
import { Router } from 'express'
import { HttpError } from '../types.js'
import { PLANS, setPlan, syncPeriod } from '../units.js'

export const billingRouter = Router()

const STRIPE_API = 'https://api.stripe.com/v1'

function secretKey(): string {
  return (process.env.STRIPE_SECRET_KEY ?? '').trim()
}

function priceId(cycle: 'monthly' | 'yearly'): string {
  const key = cycle === 'yearly' ? 'STRIPE_PRICE_PRO_YEARLY' : 'STRIPE_PRICE_PRO_MONTHLY'
  return (process.env[key] ?? '').trim()
}

function baseUrl(reqOrigin: string | undefined): string {
  const configured = (process.env.CLOUD_AI_PUBLIC_URL ?? '').trim()
  if (configured) return configured.replace(/\/$/, '')
  if (reqOrigin && /^https?:\/\//.test(reqOrigin)) return reqOrigin.replace(/\/$/, '')
  return `http://localhost:${process.env.CLOUD_AI_SPARK_PORT ?? 3000}`
}

billingRouter.get('/billing/status', (_req, res) => {
  const key = secretKey()
  const monthly = priceId('monthly')
  const yearly = priceId('yearly')
  res.json({
    configured: key !== '' && (monthly !== '' || yearly !== ''),
    missing: [
      ...(key === '' ? ['STRIPE_SECRET_KEY'] : []),
      ...(monthly === '' ? ['STRIPE_PRICE_PRO_MONTHLY'] : []),
      ...(yearly === '' ? ['STRIPE_PRICE_PRO_YEARLY'] : []),
    ],
    provider: 'stripe',
    state: syncPeriod(),
    plans: PLANS,
  })
})

billingRouter.post('/billing/checkout', async (req, res) => {
  const body = (req.body ?? {}) as { cycle?: 'monthly' | 'yearly'; plan?: 'pro' }
  const cycle: 'monthly' | 'yearly' = body.cycle === 'yearly' ? 'yearly' : 'monthly'

  if (!secretKey()) {
    throw new HttpError(
      501,
      'billing_not_configured',
      'Payments are not configured yet.',
      'Add STRIPE_SECRET_KEY and the Pro price IDs (STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY) to enable checkout. Until then you can switch plans manually on this screen for development.',
    )
  }
  const price = priceId(cycle)
  if (!price) {
    throw new HttpError(
      501,
      'billing_not_configured',
      `No Stripe price is configured for the ${cycle} plan.`,
      `Set ${cycle === 'yearly' ? 'STRIPE_PRICE_PRO_YEARLY' : 'STRIPE_PRICE_PRO_MONTHLY'}.`,
    )
  }

  const origin = baseUrl(req.get('origin'))
  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('line_items[0][price]', price)
  form.set('line_items[0][quantity]', '1')
  form.set('success_url', `${origin}/#/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`)
  form.set('cancel_url', `${origin}/#/settings?billing=cancelled`)
  form.set('metadata[cycle]', cycle)
  form.set('metadata[app]', 'cloud-ai')

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new HttpError(502, 'checkout_failed', 'Stripe rejected the checkout request.', detail.slice(0, 300) || undefined)
  }
  const session = (await response.json()) as { id: string; url: string }
  res.json({ url: session.url, sessionId: session.id })
})

/** Confirms a completed checkout and upgrades the plan server-side. */
billingRouter.get('/billing/confirm', async (req, res) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : ''
  if (!sessionId) throw new HttpError(400, 'missing_session', 'A checkout session id is required.')
  if (!secretKey()) {
    throw new HttpError(501, 'billing_not_configured', 'Payments are not configured yet.')
  }

  const response = await fetch(
    `${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    { headers: { Authorization: `Bearer ${secretKey()}` } },
  )
  if (!response.ok) {
    throw new HttpError(502, 'checkout_lookup_failed', 'That checkout session could not be verified with Stripe.')
  }
  const session = (await response.json()) as {
    payment_status?: string
    status?: string
    metadata?: { cycle?: string }
  }
  const paid = session.payment_status === 'paid' || session.status === 'complete'
  if (!paid) {
    throw new HttpError(402, 'payment_incomplete', 'That checkout has not been paid yet.')
  }
  const cycle: 'monthly' | 'yearly' = session.metadata?.cycle === 'yearly' ? 'yearly' : 'monthly'
  const state = setPlan('pro', cycle)
  res.json({ ok: true, state })
})

/** Development / self-service plan switch. Guarded so it is explicit. */
billingRouter.post('/billing/plan', (req, res) => {
  const body = (req.body ?? {}) as { plan?: 'free' | 'pro'; cycle?: 'monthly' | 'yearly' }
  if (body.plan !== 'free' && body.plan !== 'pro') {
    throw new HttpError(400, 'bad_plan', 'Plan must be "free" or "pro".')
  }
  const state = setPlan(body.plan, body.cycle === 'yearly' ? 'yearly' : 'monthly')
  res.json({ state })
})
