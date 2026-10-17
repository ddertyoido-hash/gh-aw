/**
 * Image generation studio.
 *
 * Prompt editor, aspect ratio, model and size selection, live progress, a
 * gallery of everything you have generated, and a full-size preview with
 * download, copy prompt and regenerate. Generation runs against the configured
 * provider - when none is available the studio says so instead of showing
 * placeholder art.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { api, ApiFailure, type GeneratedImage, type ProviderModel } from '../../lib/api'
import { saveFile } from '../../lib/desktop'
import { consumePendingPrompt } from '../../lib/promptBus'
import { navigate } from '../../lib/router'
import { useAppStore } from '../../store/app'
import { cn, copyText, formatRelative, slugify } from '../../lib/utils'
import { Button, Field, IconButton, Select, Spinner, Textarea } from '../common/Controls'
import { EmptyState, ErrorBanner } from '../common/States'
import { Modal } from '../common/Modal'

interface ImageProviderOption {
  id: string
  label: string
  configured: boolean
  supportsImages: boolean
  configIssue: string | null
  models: ProviderModel[]
}

export function ImagesView() {
  const pushToast = useAppStore((state) => state.pushToast)
  const unitCost = useAppStore((state) => state.unitCosts.image ?? 5)
  const units = useAppStore((state) => state.units)
  const refreshUnits = useAppStore((state) => state.refreshUnits)

  const [providers, setProviders] = useState<ImageProviderOption[]>([])
  const [aspects, setAspects] = useState<Array<{ id: string; label: string; width: number; height: number }>>([])
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [aspect, setAspect] = useState('1:1')
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [progress, setProgress] = useState<{ note: string; step: number; total: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null)
  const [preview, setPreview] = useState<GeneratedImage | null>(null)
  const [loading, setLoading] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const loadGallery = useCallback(async () => {
    const result = await api.images()
    setImages(result.images)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [options, gallery] = await Promise.all([api.imageOptions(), api.images()])
        if (!active) return
        const usable = options.providers.filter((provider) => provider.supportsImages)
        setProviders(usable)
        setAspects(options.aspects)
        setImages(gallery.images)
        const firstConfigured = usable.find((provider) => provider.configured)
        if (firstConfigured) {
          setProviderId(firstConfigured.id)
          const preferred = firstConfigured.models.find((model) => model.id.startsWith('gpt-image')) ?? firstConfigured.models[0]
          setModelId(preferred?.id ?? '')
        }
      } catch (loadError) {
        if (active) {
          setError({
            message: loadError instanceof ApiFailure ? loadError.message : 'The image studio could not load.',
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  // The dock's quick action hands a prompt over here.
  useEffect(() => {
    const pending = consumePendingPrompt()
    if (pending?.text) setPrompt(pending.text)
  }, [])

  const provider = useMemo(() => providers.find((candidate) => candidate.id === providerId), [providers, providerId])
  const model = useMemo(() => provider?.models.find((candidate) => candidate.id === modelId), [provider, modelId])
  const currentAspect = useMemo(() => aspects.find((candidate) => candidate.id === aspect) ?? aspects[0], [aspects, aspect])

  const generate = async () => {
    if (!provider || !model) return
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError({ message: 'Describe the image you want to create first.' })
      return
    }
    setError(null)
    setProgress({ note: 'Starting', step: 0, total: 3 })
    setGenerating(true)
    const controller = new AbortController()
    controllerRef.current = controller
    let created: GeneratedImage | null = null

    try {
      await api.streamImage(
        { provider: provider.id, model: model.id, prompt: trimmed, aspect },
        {
          onEvent: (event, data) => {
            if (event === 'progress') {
              setProgress({ note: data.note as string, step: (data.step as number) ?? 1, total: (data.total as number) ?? 3 })
            } else if (event === 'done') {
              created = data.image as GeneratedImage
              setImages((current) => [created as GeneratedImage, ...current])
              setProgress(null)
              pushToast({ tone: 'success', title: 'Image ready', description: model.label })
            } else if (event === 'error') {
              setError({ message: data.message as string, hint: data.hint as string | undefined })
              setProgress(null)
            }
          },
        },
        controller.signal,
      )
    } catch (generationError) {
      if (!controller.signal.aborted) {
        setError({
          message: generationError instanceof ApiFailure ? generationError.message : 'Image generation failed.',
          hint: generationError instanceof ApiFailure ? generationError.hint : undefined,
        })
      }
    } finally {
      controllerRef.current = null
      setGenerating(false)
      setProgress(null)
      void refreshUnits()
      if (created) void loadGallery()
    }
  }

  const download = async (image: GeneratedImage) => {
    const saved = await saveFile({ filename: `cloud-ai-${slugify(image.prompt).slice(0, 32)}.png`, url: image.url })
    pushToast({
      tone: saved ? 'success' : 'error',
      title: saved ? 'Saved to your device' : 'Save cancelled',
    })
  }

  const remove = async (image: GeneratedImage) => {
    try {
      await api.deleteImage(image.id)
      setImages((current) => current.filter((candidate) => candidate.id !== image.id))
      setPreview(null)
      pushToast({ tone: 'success', title: 'Image deleted' })
    } catch (deleteError) {
      pushToast({
        tone: 'error',
        title: 'Could not delete the image',
        description: deleteError instanceof ApiFailure ? deleteError.message : undefined,
      })
    }
  }

  const noImageProvider = !loading && providers.every((candidate) => !candidate.configured)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-28 pt-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Image studio</h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Describe it, choose the shape, and Cloud AI generates it with your configured provider.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Layers size={14} />
          {images.length} image{images.length === 1 ? '' : 's'} generated
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ------------------------------ controls ------------------------------ */}
        <section className="glass h-fit rounded-3xl p-4">
          <Field label="Prompt" hint="Be specific: subject, setting, light, mood, style.">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              placeholder="A serene alpine lake at golden hour, mountains behind, soft clouds, cinematic light"
            />
          </Field>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Provider">
              <Select
                value={providerId}
                onChange={(event) => {
                  const next = providers.find((candidate) => candidate.id === event.target.value)
                  setProviderId(event.target.value)
                  setModelId(next?.models[0]?.id ?? '')
                }}
                disabled={providers.length === 0}
              >
                {providers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id} disabled={!candidate.configured}>
                    {candidate.label}
                    {candidate.configured ? '' : ' — not configured'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Model">
              <Select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={!provider}>
                {(provider?.models ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wide text-ink-muted">Aspect ratio</span>
            <div className="flex flex-wrap gap-2">
              {aspects.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAspect(option.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border px-3 py-2 transition',
                    aspect === option.id
                      ? 'border-white/70 bg-white/80 shadow-sm dark:border-white/25 dark:bg-white/15'
                      : 'border-white/50 bg-white/40 hover:bg-white/60 dark:border-white/10 dark:bg-white/5',
                  )}
                  aria-pressed={aspect === option.id}
                >
                  <span
                    className="rounded-md border border-current opacity-60"
                    style={{
                      width: option.width >= option.height ? 26 : Math.round((26 * option.width) / option.height),
                      height: option.width >= option.height ? Math.round((26 * option.height) / option.width) : 26,
                    }}
                  />
                  <span className="text-[11.5px] font-medium text-ink-soft">{option.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[12.5px] text-ink-muted">
            <span>
              {currentAspect ? `${currentAspect.width}×${currentAspect.height} · ` : ''}
              {unitCost} AI units
            </span>
            <span className="tabular-nums">{units ? `${units.remaining} left` : ''}</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              icon={generating ? <Spinner size={15} /> : <Wand2 size={16} />}
              onClick={() => void generate()}
              disabled={generating || noImageProvider || !model}
            >
              {generating ? 'Generating…' : 'Generate image'}
            </Button>
            {generating && (
              <Button variant="danger" size="lg" onClick={() => controllerRef.current?.abort()}>
                Stop
              </Button>
            )}
          </div>

          {progress && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12px] text-ink-muted">
                <span>{progress.note}</span>
                <span>
                  step {Math.max(1, progress.step)}/{progress.total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-400/30 dark:bg-slate-600/50">
                <motion.div
                  className="h-full rounded-full aurora-surface"
                  animate={{ width: `${Math.min(100, (Math.max(1, progress.step) / progress.total) * 100)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <ErrorBanner
                className="mt-3"
                message={error.message}
                hint={error.hint}
                onRetry={error.message.includes('units') ? undefined : () => void generate()}
                onDismiss={() => setError(null)}
              />
            )}
          </AnimatePresence>

          {noImageProvider && (
            <div className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 text-[12.5px] leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="font-medium">No image model is connected</div>
              <p className="mt-1">
                Image generation needs an OpenAI key (GPT Image or DALL·E 3) or a Google AI key (Imagen 4). Add one to
                start generating.
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="soft"
                icon={<ArrowRight size={14} />}
                onClick={() => navigate('/settings?tab=providers')}
              >
                Configure providers
              </Button>
            </div>
          )}
        </section>

        {/* ------------------------------- gallery ------------------------------- */}
        <section className="min-w-0">
          {loading ? (
            <div className="glass flex h-64 items-center justify-center gap-2 rounded-3xl text-[13px] text-ink-muted">
              <Spinner size={15} />
              Loading your gallery
            </div>
          ) : images.length === 0 ? (
            <div className="glass rounded-3xl">
              <EmptyState
                icon={<ImageIcon size={20} />}
                title="No images yet"
                description="Your generated images are stored locally and will appear here, newest first."
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence initial={false}>
                {images.map((image) => (
                  <motion.button
                    key={image.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    whileHover={{ y: -3 }}
                    onClick={() => setPreview(image)}
                    className="group relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 shadow-sm transition hover:shadow-float focus-ring dark:border-white/10 dark:bg-white/5"
                  >
                    <img src={image.url} alt={image.prompt} className="aspect-square w-full object-cover" loading="lazy" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-2.5 pb-2 pt-6 text-left">
                      <span className="line-clamp-2 text-[11.5px] font-medium text-white/95">{image.prompt}</span>
                      <span className="mt-0.5 block text-[10.5px] text-white/70">
                        {image.model} · {formatRelative(image.created_at)}
                      </span>
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------- preview ------------------------------- */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        width="xl"
        title={preview ? `Generated with ${preview.model}` : ''}
        description={preview?.revised_prompt ?? preview?.prompt}
      >
        {preview && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-white/50 bg-slate-950/5 dark:border-white/10">
              <img src={preview.url} alt={preview.prompt} className="max-h-[62vh] w-full object-contain" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={<Download size={15} />} onClick={() => void download(preview)}>
                Download
              </Button>
              <Button
                variant="soft"
                icon={<Copy size={15} />}
                onClick={async () => {
                  const ok = await copyText(preview.prompt)
                  pushToast({ tone: ok ? 'success' : 'error', title: ok ? 'Prompt copied' : 'Copy failed' })
                }}
              >
                Copy prompt
              </Button>
              <Button
                variant="soft"
                icon={<RefreshCw size={15} />}
                onClick={() => {
                  setPrompt(preview.prompt)
                  setAspect(preview.aspect)
                  setPreview(null)
                  void generate()
                }}
              >
                Generate again
              </Button>
              <span className="mx-auto text-[12px] text-ink-muted">
                {preview.size} · {preview.aspect} · {preview.units} units
              </span>
              <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => void remove(preview)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <div className="flex items-center gap-2 text-[12px] text-ink-muted">
        <Sparkles size={13} />
        Images are saved in the Cloud AI data folder and never leave your machine unless you send them to a provider for
        editing.
      </div>
    </div>
  )
}
