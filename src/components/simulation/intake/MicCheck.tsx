"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Mic, MicOff, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { dbfs, type MicCheckResult, type MicFailure, type MicVerdict } from "@/lib/micCheck"
import { runMicCheck, type MicCheckProgress } from "@/lib/micCapture"
import { BTN_SECONDARY } from "@/components/shared/buttons"

type CheckState =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "running"; progress: MicCheckProgress }
  | { kind: "result"; result: MicCheckResult }
  | { kind: "failed"; failure: MicFailure }

type MicCheckProps = {
  // Null when the panel offers a choice of panelists.
  panelistFirstName: string | null
  onResult: (result: MicCheckResult) => void
}

// The name never opens a sentence, so the "your panelist" fallback reads
// correctly without capitalization logic.
const VERDICT_COPY: Record<MicVerdict, (who: string) => string> = {
  good: () => "Good to go. Quiet room, clear voice.",
  workable: (who) =>
    `Some background noise, so ${who} may take a beat to know you're done. A headset mic helps.`,
  noisy: (who) =>
    `It's loud where you are, so ${who} will struggle to tell when you've finished. Use a headset mic, or find a quieter spot.`,
  silent: () => "We didn't hear you. Check your browser is using the mic you expect, then check again.",
}

const FAILURE_COPY: Record<MicFailure, string> = {
  denied:
    "Microphone access is blocked. Allow it in your browser's site settings, then check again. The room can't hear you until it's allowed.",
  "no-device": "No microphone found. Plug one in or connect a headset, then check again.",
  busy: "Another app is using your microphone. Close it, then check again.",
  hidden: "Stay on this tab during the check.",
  unavailable: "Couldn't start the check. Try again.",
}

// Tailwind compiles only classes it can see, so the meter's width is one
// of these, never a computed style.
const LEVEL_WIDTHS = ["w-0", "w-[12%]", "w-1/4", "w-[37%]", "w-1/2", "w-[62%]", "w-3/4", "w-[87%]", "w-full"]
const LEVEL_FLOOR_DB = -60

const levelWidth = (level: number): string => {
  const fraction = Math.min(1, Math.max(0, (dbfs(level) - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB))
  return LEVEL_WIDTHS[Math.round(fraction * (LEVEL_WIDTHS.length - 1))]
}

const VerdictIcon = ({ verdict }: { verdict: MicVerdict }) => {
  if (verdict === "good") return <CheckCircle2 className="size-4 flex-none text-accent-blue" />
  if (verdict === "silent") return <MicOff className="size-4 flex-none text-red-fg" />
  return <AlertTriangle className="size-4 flex-none text-warn" />
}

// The pre-room mic check: one card, rendered from one state. Advisory on
// purpose; "Enter the room" never depends on it. The first click is also
// the browser's permission gesture, so the prompt never costs room time.
export const MicCheck = ({ panelistFirstName, onResult }: MicCheckProps) => {
  const [state, setState] = useState<CheckState>({ kind: "idle" })
  const abortRef = useRef<AbortController | null>(null)
  const who = panelistFirstName ?? "your panelist"

  // The capture is the external system: leaving the page mid-check must
  // release the mic.
  useEffect(() => () => abortRef.current?.abort(), [])

  const handleCheck = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ kind: "requesting" })
    const outcome = await runMicCheck({
      onProgress: (progress) => setState({ kind: "running", progress }),
      signal: controller.signal,
    })
    if (controller.signal.aborted) return
    if (outcome.ok) {
      setState({ kind: "result", result: outcome.result })
      onResult(outcome.result)
      return
    }
    if (outcome.failure !== "aborted") setState({ kind: "failed", failure: outcome.failure })
  }

  const busy = state.kind === "requesting" || state.kind === "running"

  return (
    <section
      aria-labelledby="mic-check-heading"
      className="mx-auto mb-6 max-w-[660px] rounded-2xl border border-line bg-surface-raised px-6 py-5 text-left shadow-card max-md:px-5"
    >
      <div className="flex items-start justify-between gap-4 max-md:flex-col">
        <div className="min-w-0 flex-1">
          <h2 id="mic-check-heading" className="flex items-center gap-2 text-[15px] font-semibold">
            <Mic className="size-4 text-on-surface-3" />
            Before you enter, check your mic
          </h2>
          <div role="status" className="mt-1.5 text-[13.5px] leading-relaxed text-on-surface-2">
            {state.kind === "idle" &&
              `Background noise can make ${who} cut in early or wait too long.`}
            {state.kind === "requesting" && "Waiting for microphone access."}
            {state.kind === "running" && (
              <>
                {state.progress.beat === "quiet" ? "Stay quiet for a moment" : "Now say a sentence"}
                {/* Visual pacing only: a live region that counted down
                    would announce every second. */}
                <span aria-hidden="true"> · {Math.ceil(state.progress.remainingMs / 1000)}</span>
              </>
            )}
            {state.kind === "result" && (
              <span className="flex items-start gap-2">
                <VerdictIcon verdict={state.result.verdict} />
                <span>
                  {VERDICT_COPY[state.result.verdict](who)}
                  {state.result.device && (
                    <span className="mt-0.5 block text-[12px] text-on-surface-3">
                      Using {state.result.device}
                    </span>
                  )}
                </span>
              </span>
            )}
            {state.kind === "failed" && (
              <span className="flex items-start gap-2">
                <MicOff className="size-4 flex-none text-red-fg" />
                <span>{FAILURE_COPY[state.failure]}</span>
              </span>
            )}
          </div>
          {state.kind === "running" && (
            <div aria-hidden="true" className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn(
                  "h-full rounded-full bg-accent-blue transition-[width] duration-100 motion-reduce:transition-none",
                  levelWidth(state.progress.level)
                )}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleCheck}
          disabled={busy}
          className={cn(BTN_SECONDARY, "flex-none max-md:w-full")}
        >
          {state.kind === "idle" ? <Mic className="size-[14px]" /> : <RefreshCw className="size-[14px]" />}
          {state.kind === "idle" ? "Check your mic" : busy ? "Checking" : "Check again"}
        </button>
      </div>
    </section>
  )
}
