import {
  QUIET_BEAT_MS,
  ROOM_MIC_CONSTRAINTS,
  SAMPLE_EVERY_MS,
  SPEAK_BEAT_MS,
  WARMUP_MS,
  dbfs,
  failureFrom,
  median,
  micVerdict,
  percentile,
  type MicCheckResult,
  type MicFailure,
} from "./micCheck.ts"

// The browser half of the mic check: open the mic the way the room does,
// sample its level for two beats, hand the numbers to the rules. The mic is
// open only for the duration of the call; every exit releases it.

export type MicCheckProgress = { beat: "quiet" | "speak"; remainingMs: number; level: number }
export type MicCheckOutcome =
  | { ok: true; result: MicCheckResult }
  | { ok: false; failure: MicFailure | "aborted" }

type RunMicCheckOptions = {
  onProgress: (progress: MicCheckProgress) => void
  signal: AbortSignal
}

const TOTAL_MS = QUIET_BEAT_MS + SPEAK_BEAT_MS

const rmsOf = (buffer: Float32Array): number => {
  let sumOfSquares = 0
  for (let i = 0; i < buffer.length; i++) sumOfSquares += buffer[i] * buffer[i]
  return Math.sqrt(sumOfSquares / buffer.length)
}

export const runMicCheck = async ({ onProgress, signal }: RunMicCheckOptions): Promise<MicCheckOutcome> => {
  let stream: MediaStream | null = null
  let context: AudioContext | null = null
  let sampler: ReturnType<typeof setInterval> | null = null
  // Every listener this check adds is scoped to this signal; finally aborts
  // it, and the platform removes them.
  const cleanup = new AbortController()
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: ROOM_MIC_CONSTRAINTS })
    if (signal.aborted) return { ok: false, failure: "aborted" }
    context = new AudioContext()
    await context.resume()
    // Without the click's activation (iOS Safari) the context never runs
    // and every sample would read as silence.
    if (context.state !== "running") return { ok: false, failure: "unavailable" }

    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    context.createMediaStreamSource(stream).connect(analyser)
    const buffer = new Float32Array(analyser.fftSize)
    const device = stream.getAudioTracks()[0]?.label ?? ""
    const quiet: number[] = []
    const speak: number[] = []
    const startedAt = Date.now()

    return await new Promise<MicCheckOutcome>((resolve) => {
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "hidden") resolve({ ok: false, failure: "hidden" })
        },
        { signal: cleanup.signal }
      )
      signal.addEventListener("abort", () => resolve({ ok: false, failure: "aborted" }), {
        signal: cleanup.signal,
      })
      sampler = setInterval(() => {
        const elapsed = Date.now() - startedAt
        if (elapsed >= TOTAL_MS) {
          const noiseDb = dbfs(median(quiet))
          const voiceDb = dbfs(percentile(speak, 0.9))
          resolve({
            ok: true,
            result: { verdict: micVerdict(noiseDb, voiceDb), noiseDb, voiceDb, device },
          })
          return
        }
        analyser.getFloatTimeDomainData(buffer)
        const level = rmsOf(buffer)
        const inQuiet = elapsed < QUIET_BEAT_MS
        const beatElapsed = inQuiet ? elapsed : elapsed - QUIET_BEAT_MS
        if (beatElapsed >= WARMUP_MS) (inQuiet ? quiet : speak).push(level)
        onProgress({
          beat: inQuiet ? "quiet" : "speak",
          remainingMs: (inQuiet ? QUIET_BEAT_MS : TOTAL_MS) - elapsed,
          level,
        })
      }, SAMPLE_EVERY_MS)
    })
  } catch (error) {
    return { ok: false, failure: failureFrom(error) }
  } finally {
    if (sampler) clearInterval(sampler)
    cleanup.abort()
    stream?.getTracks().forEach((track) => track.stop())
    void context?.close().catch(() => {})
  }
}
