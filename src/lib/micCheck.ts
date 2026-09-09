// The pre-room mic check's rules: units, the statistics that make a
// seven-second sample honest, the verdict, and the failure vocabulary.
// Pure, so the verdict is testable without a microphone; the browser
// capture lives in micCapture.ts.

export type MicVerdict = "good" | "workable" | "noisy" | "silent"
export type MicFailure = "denied" | "no-device" | "busy" | "hidden" | "unavailable"
export type MicCheckResult = {
  verdict: MicVerdict
  noiseDb: number
  voiceDb: number
  // The input the browser used, as it names it ("MacBook Pro Microphone").
  device: string
}

export const QUIET_BEAT_MS = 3_000
export const SPEAK_BEAT_MS = 4_000
// Auto gain ramps and Bluetooth headsets switch profiles in the first
// second; samples before this point lie.
export const WARMUP_MS = 1_000
export const SAMPLE_EVERY_MS = 100
export const MIN_DB = -100

// Verdict thresholds, in dBFS after the room's own processing. Starting
// values, hand-checked; production sessions carry the measured numbers so
// these move from data.
export const SILENT_GAP_DB = 6
export const NOISY_GAP_DB = 10
export const GOOD_GAP_DB = 18
export const QUIET_FLOOR_DB = -50
export const LOUD_FLOOR_DB = -38

// LiveKit's audio defaults, which the room's mic runs with, so the check
// hears what the avatar hears. Browsers that do not know voiceIsolation
// ignore it, matching what the room gets there.
export const ROOM_MIC_CONSTRAINTS: MediaTrackConstraints & { voiceIsolation: boolean } = {
  deviceId: { ideal: "default" },
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
}

export const dbfs = (rms: number): number =>
  rms <= 0 ? MIN_DB : Math.max(MIN_DB, 20 * Math.log10(rms))

const sorted = (values: number[]): number[] => [...values].sort((a, b) => a - b)

// A door, a cough, or one word during the quiet beat barely moves this.
export const median = (values: number[]): number => {
  if (values.length === 0) return MIN_DB
  const s = sorted(values)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Nearest rank: a sentence with pauses reads at its speaking level, one
// syllable does not pass.
export const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return MIN_DB
  const s = sorted(values)
  const rank = Math.min(s.length, Math.max(1, Math.ceil(p * s.length)))
  return s[rank - 1]
}

export const micVerdict = (noiseDb: number, voiceDb: number): MicVerdict => {
  const gap = voiceDb - noiseDb
  if (gap < SILENT_GAP_DB) return "silent"
  if (noiseDb >= LOUD_FLOOR_DB || gap < NOISY_GAP_DB) return "noisy"
  if (noiseDb <= QUIET_FLOOR_DB && gap >= GOOD_GAP_DB) return "good"
  return "workable"
}

// getUserMedia rejects with a DOMException whose name is the contract.
export const failureFrom = (error: unknown): MicFailure => {
  const name = error instanceof Error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "denied"
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-device"
  if (name === "NotReadableError" || name === "AbortError") return "busy"
  return "unavailable"
}
