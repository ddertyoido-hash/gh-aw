/**
 * Voice hooks: speech recognition, audio recording and speech synthesis.
 *
 * The browser engines (Web Speech API) are used by default so voice works
 * without any credentials. When an OpenAI key is configured the user can pick
 * the server engine in Settings, Voice - then recording is transcribed by the
 * provider and replies are synthesised server-side.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiFailure } from './api'
import { supportsBrowserSpeech, supportsSpeechSynthesis } from './desktop'
import { useAppStore } from '../store/app'

/* --------------------------- speech recognition --------------------------- */

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const candidate =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null
  return candidate as (new () => SpeechRecognitionLike) | null
}

export interface VoiceInput {
  supported: boolean
  listening: boolean
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  /** Final transcript accumulated in the current session. */
  transcript: string
  reset: () => void
}

export function useVoiceInput(onFinal?: (text: string) => void): VoiceInput {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const supported = supportsBrowserSpeech()

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    setError(null)
    const Ctor = recognitionCtor()
    if (!Ctor) {
      setError('This browser cannot transcribe speech. Use the recorder instead, or open Cloud AI in Chromium.')
      return
    }
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText) {
        setTranscript((previous) => `${previous}${finalText}`)
        onFinal?.(finalText)
      }
      setInterim(interimText)
    }
    recognition.onerror = (event: any) => {
      const code = event?.error ?? 'unknown'
      setError(
        code === 'not-allowed'
          ? 'Microphone access was blocked. Allow it in your browser or system settings and try again.'
          : `Speech recognition stopped: ${code}`,
      )
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'The microphone could not be started.')
    }
  }, [onFinal])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return {
    supported,
    listening,
    interim,
    error,
    start,
    stop,
    transcript,
    reset: () => {
      setTranscript('')
      setInterim('')
      setError(null)
    },
  }
}

/* ------------------------------ audio capture ----------------------------- */

export interface AudioRecorder {
  supported: boolean
  recording: boolean
  seconds: number
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<Blob | null>
}

/** Records microphone audio so the server can transcribe it. */
export function useAudioRecorder(): AudioRecorder {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window

  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])

  const start = useCallback(async () => {
    setError(null)
    if (!supported) {
      setError('Recording is not available in this environment.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.start()
      recorderRef.current = recorder
      setSeconds(0)
      setRecording(true)
    } catch (permissionError) {
      setError(
        permissionError instanceof Error && permissionError.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it for Cloud AI and try again.'
          : 'The microphone could not be opened.',
      )
    }
  }, [supported])

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current
    if (!recorder) return null
    const done = new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: 'audio/webm' }) : null
        resolve(blob)
      }
    })
    recorder.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setRecording(false)
    return done
  }, [])

  return { supported, recording, seconds, error, start, stop }
}

/* ----------------------------- speech synthesis ---------------------------- */

export interface Speaker {
  supported: boolean
  speaking: boolean
  voices: SpeechSynthesisVoice[]
  speak: (text: string) => Promise<void>
  cancel: () => void
  serverAvailable: boolean
}

export function useSpeaker(): Speaker {
  const settings = useAppStore((state) => state.settings)
  const pushToast = useAppStore((state) => state.pushToast)
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [serverAvailable, setServerAvailable] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!supportsSpeechSynthesis()) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  useEffect(() => {
    api
      .voiceCapabilities()
      .then((capabilities) => setServerAvailable(capabilities.serverSpeech))
      .catch(() => setServerAvailable(false))
  }, [])

  const cancel = useCallback(() => {
    if (supportsSpeechSynthesis()) window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      const clean = text.replace(/```[\s\S]*?```/g, ' code block ').slice(0, 4000)
      if (!clean.trim()) return
      cancel()
      setSpeaking(true)

      if (settings.voice.useServerTts && serverAvailable) {
        try {
          const blob = await api.speech(clean, 'alloy')
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            setSpeaking(false)
            URL.revokeObjectURL(url)
          }
          await audio.play()
          return
        } catch (error) {
          setSpeaking(false)
          pushToast({
            tone: 'error',
            title: 'Server voice failed',
            description: error instanceof ApiFailure ? error.message : 'Falling back to your device voice is off.',
          })
          return
        }
      }

      if (!supportsSpeechSynthesis()) {
        setSpeaking(false)
        pushToast({ tone: 'error', title: 'This device has no speech voices available.' })
        return
      }
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = settings.voice.rate
      utterance.pitch = settings.voice.pitch
      utterance.lang = settings.voice.language
      const preferred = voices.find((voice) => voice.name === settings.voice.voiceName)
      if (preferred) utterance.voice = preferred
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    },
    [cancel, pushToast, serverAvailable, settings.voice, voices],
  )

  const value = useMemo(
    () => ({ supported: supportsSpeechSynthesis(), speaking, voices, speak, cancel, serverAvailable }),
    [cancel, serverAvailable, speak, speaking, voices],
  )

  return value
}
