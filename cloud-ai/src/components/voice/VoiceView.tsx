/**
 * Voice screen: talk to Cloud AI and hear the answer back.
 *
 * Browser speech recognition and the device voice need no credentials; when an
 * OpenAI key is present the server can transcribe recordings and synthesise
 * speech instead. Microphone permission state is shown explicitly, and every
 * failure path explains what to do next.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Mic, MicOff, Radio, Send, Square, Volume2, VolumeX } from 'lucide-react'
import { api, ApiFailure } from '../../lib/api'
import { supportsBrowserSpeech, supportsSpeechSynthesis } from '../../lib/desktop'
import { useAudioRecorder, useSpeaker, useVoiceInput } from '../../lib/useVoice'
import { useAppStore } from '../../store/app'
import { useChatStore } from '../../store/chat'
import { cn } from '../../lib/utils'
import { Button, Field, Segmented, Select, Textarea, Toggle } from '../common/Controls'
import { ErrorBanner } from '../common/States'
import { ThreadView } from '../chat/ThreadView'

type TranscriptionEngine = 'browser' | 'server'

export function VoiceView() {
  const settings = useAppStore((state) => state.settings)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const pushToast = useAppStore((state) => state.pushToast)
  const refreshUnits = useAppStore((state) => state.refreshUnits)

  const messages = useChatStore((state) => state.messages)
  const streaming = useChatStore((state) => state.streaming)
  const send = useChatStore((state) => state.send)
  const stop = useChatStore((state) => state.stop)

  const [capabilities, setCapabilities] = useState<{
    serverTranscription: boolean
    serverSpeech: boolean
    transcribeModel: string
    speechModel: string
  } | null>(null)
  const [engine, setEngine] = useState<TranscriptionEngine>('browser')
  const [transcript, setTranscript] = useState('')
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null)
  const [transcribing, setTranscribing] = useState(false)

  const voiceInput = useVoiceInput((finalText) => {
    setTranscript((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${finalText}`.trimStart())
  })
  const recorder = useAudioRecorder()
  const speaker = useSpeaker()

  useEffect(() => {
    api
      .voiceCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null))
  }, [])

  useEffect(() => {
    const permissions = (navigator as unknown as { permissions?: Permissions }).permissions
    if (!permissions?.query) {
      setPermission('unknown')
      return
    }
    permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setPermission(status.state as typeof permission)
        status.onchange = () => setPermission(status.state as typeof permission)
      })
      .catch(() => setPermission('unknown'))
  }, [voiceInput.listening])

  const lastAssistant = useMemo(() => [...messages].reverse().find((message) => message.role === 'assistant'), [messages])

  const serverEngineAvailable = Boolean(capabilities?.serverTranscription)

  const askCloud = async () => {
    const question = transcript.trim()
    if (!question) return
    await send({
      content: question,
      provider: settings.defaultProvider,
      model: settings.defaultModel,
      mode: 'chat',
      agentId: null,
      conversationId: useChatStore.getState().conversationId,
    })
    setTranscript('')
  }

  const transcribeRecording = async () => {
    if (!recorder.recording) {
      await recorder.start()
      return
    }
    setError(null)
    const blob = await recorder.stop()
    if (!blob) {
      setError({ message: 'Nothing was recorded. Try again and speak for a moment.' })
      return
    }
    setTranscribing(true)
    try {
      const result = await api.transcribe(blob)
      setTranscript((current) => `${current}${current ? ' ' : ''}${result.text}`.trim())
      void refreshUnits()
      pushToast({ tone: 'success', title: 'Audio transcribed', description: capabilities?.transcribeModel })
    } catch (transcriptionError) {
      setError({
        message: transcriptionError instanceof ApiFailure ? transcriptionError.message : 'Transcription failed.',
        hint: transcriptionError instanceof ApiFailure ? transcriptionError.hint : undefined,
      })
    } finally {
      setTranscribing(false)
    }
  }

  const micStatus = useMemo(() => {
    if (!voiceInput.supported && !serverEngineAvailable) {
      return { tone: 'error' as const, text: 'No speech recognition is available in this environment.' }
    }
    if (permission === 'denied') {
      return { tone: 'error' as const, text: 'Microphone access is blocked in your system or browser settings.' }
    }
    if (voiceInput.listening || recorder.recording) {
      return { tone: 'live' as const, text: 'Microphone is live — speak naturally.' }
    }
    if (permission === 'granted') return { tone: 'ok' as const, text: 'Microphone ready.' }
    return { tone: 'idle' as const, text: 'The microphone will ask for permission the first time you use it.' }
  }, [permission, recorder.recording, serverEngineAvailable, voiceInput.listening, voiceInput.supported])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pb-28 pt-6 sm:px-8">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">Voice assistant</h1>
        <p className="mt-1 text-[13.5px] text-ink-muted">
          Speak your question, hear the answer. Recognition and playback run on your device unless you switch to the
          server engine.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="glass h-fit rounded-3xl p-5">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-32 w-32 items-center justify-center">
              {(voiceInput.listening || recorder.recording) && (
                <>
                  <span className="absolute h-24 w-24 animate-pulse-ring rounded-full bg-[color:var(--aurora-blue)]/40" />
                  <span
                    className="absolute h-24 w-24 animate-pulse-ring rounded-full bg-[color:var(--aurora-violet)]/30"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  if (engine === 'browser') {
                    if (voiceInput.listening) voiceInput.stop()
                    else voiceInput.start()
                  } else {
                    void transcribeRecording()
                  }
                }}
                className={cn(
                  'relative flex h-24 w-24 items-center justify-center rounded-full border text-white shadow-float transition active:scale-95 focus-ring',
                  voiceInput.listening || recorder.recording
                    ? 'border-rose-200/60 bg-rose-500'
                    : 'aurora-surface border-white/40',
                )}
                aria-label={
                  voiceInput.listening || recorder.recording ? 'Stop listening' : 'Start listening'
                }
              >
                {voiceInput.listening || recorder.recording ? <MicOff size={30} /> : <Mic size={30} />}
              </button>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px]',
                micStatus.tone === 'error'
                  ? 'bg-rose-100/80 text-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
                  : micStatus.tone === 'live'
                    ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'
                    : 'bg-white/60 text-ink-soft dark:bg-white/10',
              )}
            >
              {micStatus.tone === 'error' ? <AlertCircle size={14} /> : <Radio size={14} />}
              {micStatus.text}
            </div>

            {recorder.recording && (
              <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
                <Square size={12} className="text-rose-500" />
                Recording {recorder.seconds}s — tap again to stop and transcribe
              </div>
            )}

            <div className="flex w-full items-end justify-center gap-1">
              {Array.from({ length: 24 }).map((_, index) => (
                <motion.span
                  key={index}
                  className="w-1 rounded-full bg-[color:var(--aurora-blue)]/70"
                  animate={
                    voiceInput.listening || recorder.recording
                      ? { height: [6, 26, 10, 20, 8] }
                      : { height: 6 }
                  }
                  transition={{
                    duration: 1.1,
                    repeat: voiceInput.listening || recorder.recording ? Infinity : 0,
                    delay: index * 0.045,
                  }}
                  style={{ height: 6 }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Field label="Transcription engine">
              <Segmented
                value={engine}
                onChange={(value) => {
                  setEngine(value)
                  if (value === 'server' && !serverEngineAvailable) {
                    pushToast({
                      tone: 'info',
                      title: 'Server transcription needs an OpenAI key',
                      description: 'Add OPENAI_API_KEY to transcribe recordings through the API.',
                    })
                  }
                }}
                options={[
                  { value: 'browser', label: 'On device' },
                  { value: 'server', label: 'Server' },
                ]}
              />
            </Field>

            <Field label="Transcript" hint="Edit before sending if the recogniser misheard something.">
              <Textarea
                rows={4}
                value={transcript + (voiceInput.interim ? ` ${voiceInput.interim}` : '')}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Your words appear here…"
              />
            </Field>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                icon={<Send size={15} />}
                disabled={!transcript.trim() || streaming}
                onClick={() => void askCloud()}
              >
                Ask Cloud AI
              </Button>
              <Button
                variant="soft"
                disabled={!streaming}
                icon={<Square size={14} />}
                onClick={stop}
              >
                Stop
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setTranscript('')
                  voiceInput.reset()
                }}
              >
                Clear
              </Button>
            </div>

            {transcribing && <div className="text-[12.5px] text-ink-muted">Transcribing your recording…</div>}

            <div className="space-y-2 rounded-2xl border border-white/50 bg-white/40 px-3 py-1 dark:border-white/10 dark:bg-white/5">
              <Toggle
                label="Read answers aloud"
                description="Speak every new response automatically."
                checked={settings.voice.autoSpeak}
                onChange={(value) => void saveSettings({ voice: { ...settings.voice, autoSpeak: value } })}
              />
              <Toggle
                label="Use server voice"
                description={
                  capabilities?.serverSpeech
                    ? `Synthesised by ${capabilities.speechModel} instead of your device voice.`
                    : 'Needs an OpenAI key (OPENAI_API_KEY).'
                }
                disabled={!capabilities?.serverSpeech}
                checked={settings.voice.useServerTts}
                onChange={(value) => void saveSettings({ voice: { ...settings.voice, useServerTts: value } })}
              />
              {supportsSpeechSynthesis() && speaker.voices.length > 0 && (
                <div className="py-2.5">
                  <Field label="Device voice">
                    <Select
                      value={settings.voice.voiceName}
                      onChange={(event) => void saveSettings({ voice: { ...settings.voice, voiceName: event.target.value } })}
                    >
                      <option value="">System default</option>
                      {speaker.voices.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
            </div>

            {error && (
              <ErrorBanner message={error.message} hint={error.hint} onDismiss={() => setError(null)} />
            )}

            <div className="flex flex-wrap gap-1.5 text-[11.5px] text-ink-muted">
              <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">
                On-device recognition: {supportsBrowserSpeech() ? 'available' : 'unavailable'}
              </span>
              <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">
                Server transcription: {capabilities?.serverTranscription ? capabilities.transcribeModel : 'not configured'}
              </span>
              <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">
                Device speech: {supportsSpeechSynthesis() ? `${speaker.voices.length} voices` : 'unavailable'}
              </span>
            </div>
          </div>
        </section>

        <section className="glass flex min-h-[520px] flex-col overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-white/30 px-4 py-2.5 dark:border-white/10">
            <h2 className="text-[13.5px] font-semibold text-ink">Voice session</h2>
            {lastAssistant && !lastAssistant.streaming && (
              <Button
                size="sm"
                variant="ghost"
                icon={speaker.speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                onClick={() => {
                  if (speaker.speaking) speaker.cancel()
                  else void speaker.speak(lastAssistant.content)
                }}
              >
                {speaker.speaking ? 'Stop' : 'Replay'}
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <ThreadView
              mode="chat"
              agentId={null}
              speakReplies={settings.voice.autoSpeak}
              placeholder="Type as well, or use the microphone on the left…"
              emptyTitle="Your voice session is empty"
              emptyDescription="Tap the microphone, say what you need, then send it to Cloud AI."
            />
          </div>
        </section>
      </div>
    </div>
  )
}


