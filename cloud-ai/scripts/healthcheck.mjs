#!/usr/bin/env node
/**
 * Cloud AI healthcheck.
 *
 * Verifies both components running in the app container - the Vite dev server
 * that serves the interface on port 5173 and the API on port 3001 - using only
 * existing endpoints. It prints which component failed and exits non-zero so
 * Docker can restart the container.
 */
const checks = [
  { name: 'web (interface)', url: 'http://127.0.0.1:5173/' },
  { name: 'api (Cloud AI service)', url: 'http://127.0.0.1:3001/api/system' },
]

const timeoutMs = 6000

async function probe(check) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(check.url, { signal: controller.signal })
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` }
    const body = await response.text()
    if (body.trim().length === 0) return { ok: false, detail: 'empty response' }
    return { ok: true, detail: `HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

const results = await Promise.all(checks.map(async (check) => ({ check, result: await probe(check) })))
const failures = results.filter((entry) => !entry.result.ok)

for (const entry of results) {
  console.log(`${entry.result.ok ? 'ok  ' : 'FAIL'} ${entry.check.name} -> ${entry.result.detail}`)
}

if (failures.length > 0) {
  console.error(`cloud-ai healthcheck failed for: ${failures.map((entry) => entry.check.name).join(', ')}`)
  process.exit(1)
}

process.exit(0)
