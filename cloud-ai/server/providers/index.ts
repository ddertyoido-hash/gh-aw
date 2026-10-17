/**
 * Provider registry.
 *
 * Adding a provider = write one adapter file and add it to ADAPTERS. Routes,
 * settings and the model selector all read from here, so nothing else changes.
 */
import { HttpError, type ModelInfo, type ProviderAdapter } from '../types.js'
import { anthropicProvider } from './anthropic.js'
import { googleProvider } from './google.js'
import { localProvider, openaiProvider } from './openai.js'

export const ADAPTERS: ProviderAdapter[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
  localProvider,
]

export function getProvider(id: string): ProviderAdapter {
  const adapter = ADAPTERS.find((candidate) => candidate.id === id)
  if (!adapter) {
    throw new HttpError(404, 'unknown_provider', `Unknown AI provider "${id}".`)
  }
  return adapter
}

export function providerForModel(providerId: string, modelId: string) {
  const adapter = getProvider(providerId)
  const model = adapter.models().find((candidate) => candidate.id === modelId)
  return { adapter, model }
}

export interface PublicProvider {
  id: string
  label: string
  configured: boolean
  configIssue: string | null
  docsUrl: string
  setupHint: string
  envKeys: string[]
  supportsImages: boolean
  options: Record<string, unknown>
  models: ModelInfo[]
}

export function listProviders(): PublicProvider[] {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    configured: adapter.isConfigured(),
    configIssue: adapter.configIssue?.() ?? null,
    docsUrl: adapter.docsUrl,
    setupHint: adapter.setupHint,
    envKeys: adapter.envKeys,
    supportsImages: adapter.supportsImages,
    options: adapter.options?.() ?? {},
    models: adapter.models(),
  }))
}

export function allModels(): ModelInfo[] {
  return ADAPTERS.filter((adapter) => adapter.isConfigured()).flatMap((adapter) => adapter.models())
}

export function imageModels(): ModelInfo[] {
  return ADAPTERS.filter((adapter) => adapter.supportsImages && adapter.isConfigured()).flatMap(
    (adapter) => adapter.models().filter((model) => model.capabilities.includes('image')),
  )
}

export { openaiProvider, anthropicProvider, googleProvider, localProvider }
