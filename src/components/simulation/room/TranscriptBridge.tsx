"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAvatarSession, useTranscription } from "@runwayml/avatars-react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { isAvatarSpeech } from "@/lib/transcript"

type TranscriptBridgeProps = {
  sessionId: Id<"sessions">
  character: { id: string; name: string }
  // The audio-level speaking signal (SessionStatusBridge). Its falling edge
  // is when a line is finished being spoken.
  avatarSpeaking: boolean
}

// After the audio stops, the last text chunk can still be in flight; wait
// this long before sending the line to the sign-off check.
const SPEECH_END_SETTLE_MS = 400
// Should the audio signal never fall, a long gap in the text chunks is the
// fallback. Long on purpose: chunks pause mid-sentence for a second or two.
const FALLBACK_SETTLE_MS = 5_000

type InProgressTurn = {
  firstSeenAt: number
  text: string
  settle: ReturnType<typeof setTimeout> | null
  checked: boolean
}

// Writes each avatar turn to the session transcript. Entries arrive as Runway's
// flat deltas over the data channel with no timing fields, and a turn's
// final lands only when her next turn starts — so speech onset is stamped
// from the turn's FIRST interim (which arrives at turn onset), and the final
// is written with that spokenAt. Interims are never written to Convex; the
// finished line's text goes to the sign-off check as soon as the avatar's
// audio stops, so her goodbye is not a turn late.
export const TranscriptBridge = ({ sessionId, character, avatarSpeaking }: TranscriptBridgeProps) => {
  const addTranscriptEntry = useMutation(api.sessions.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)
  const checkSignOff = useAction(api.sessions.checkSignOff)
  const session = useAvatarSession()

  // In-progress turns by id; a turn's entry is deleted when its final is
  // written, so the map only ever holds turns still being spoken.
  const turns = useRef(new Map<string, InProgressTurn>())
  const latestTurnId = useRef<string | null>(null)

  const checkProvisional = useCallback(
    (turn: InProgressTurn) => {
      if (turn.checked || turn.text.trim().length === 0) return
      turn.checked = true
      checkSignOff({ sessionId, provisional: turn.text }).catch((err) =>
        console.error("sessions.checkSignOff failed:", err)
      )
    },
    [checkSignOff, sessionId]
  )

  // The audio stopped: the line in progress is finished being spoken.
  useEffect(() => {
    if (avatarSpeaking) return
    const timer = setTimeout(() => {
      const turn = latestTurnId.current ? turns.current.get(latestTurnId.current) : undefined
      if (turn) checkProvisional(turn)
    }, SPEECH_END_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [avatarSpeaking, checkProvisional])

  useTranscription(
    (entry) => {
      if (!isAvatarSpeech(entry)) return
      const turn: InProgressTurn = turns.current.get(entry.id) ?? {
        firstSeenAt: Date.now(),
        text: "",
        settle: null,
        checked: false,
      }
      turns.current.set(entry.id, turn)
      latestTurnId.current = entry.id
      if (!entry.final) {
        turn.text = entry.text
        if (turn.settle) clearTimeout(turn.settle)
        turn.settle = setTimeout(() => {
          turn.settle = null
          checkProvisional(turn)
        }, FALLBACK_SETTLE_MS)
        return
      }
      if (turn.settle) clearTimeout(turn.settle)
      turns.current.delete(entry.id)
      if (latestTurnId.current === entry.id) latestTurnId.current = null
      void (async () => {
        try {
          const result = await addTranscriptEntry({
            id: sessionId,
            entry: {
              speaker: character.id,
              speakerName: character.name,
              text: entry.text,
              timestamp: Date.now(),
              spokenAt: turn.firstSeenAt,
              type: "panelist",
            },
          })
          if (!result?.written) return
          decide({ sessionId }).catch((err) => console.error("orchestrator.decide failed:", err))
          // The settle already checked this line; a final that beat the
          // settle (a fast next turn) still gets its check.
          if (!turn.checked) {
            checkSignOff({ sessionId }).catch((err) =>
              console.error("sessions.checkSignOff failed:", err)
            )
          }
        } catch (err) {
          console.warn("transcript write failed, avatar turn dropped:", err)
        }
      })()
    },
    { interim: true }
  )

  // The avatar session can end while the room stays live (observed: GWM
  // sessions end themselves); stale turns must not leak into a reconnected
  // session's record or fire a check for a line nobody is finishing.
  useEffect(() => {
    if (session.state !== "ended" && session.state !== "error") return
    for (const turn of turns.current.values()) {
      if (turn.settle) clearTimeout(turn.settle)
    }
    turns.current.clear()
    latestTurnId.current = null
  }, [session.state])

  return null
}
