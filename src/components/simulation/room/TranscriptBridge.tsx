"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAvatarSession, useTranscription } from "@runwayml/avatars-react"
import { useMutation, useAction } from "convex/react"
import { api } from "@convex/_generated/api"
import { Id } from "@convex/_generated/dataModel"
import { isAvatarSpeech } from "@/lib/transcript"
import { commitPending, emptySegment, ingestText, type SegmentState } from "@/lib/avatarTurns"

type TranscriptBridgeProps = {
  sessionId: Id<"sessions">
  character: { id: string; name: string }
  // The audio-level speaking signal (SessionStatusBridge). Its falling edge
  // is when a line is finished being spoken.
  avatarSpeaking: boolean
}

// After the audio stops, the last text chunk can still be in flight; wait
// this long before committing the line.
const SPEECH_END_SETTLE_MS = 400
// Should the audio signal never fall, a long gap in the text chunks is the
// fallback. Long on purpose: chunks pause mid-sentence for a second or two.
const FALLBACK_SETTLE_MS = 5_000

type Segment = {
  state: SegmentState
  settle: ReturnType<typeof setTimeout> | null
}

// Writes each avatar line to the session transcript. Entries arrive as
// Runway's flat deltas over the data channel with no timing fields and, since
// 2026-09-23, under one segment id with cumulative text and no final ever
// (the payload's turn counter stopped incrementing, and the SDK finalizes a
// turn only when the next one starts). So the line boundary is ours: the
// avatar's audio stopping, a long gap in chunks, or an SDK final if one does
// arrive. Each commit writes only the text since the last one, stamped with
// the onset of its first chunk, and the write triggers the sign-off check
// so her goodbye is not a turn late.
export const TranscriptBridge = ({ sessionId, character, avatarSpeaking }: TranscriptBridgeProps) => {
  const addTranscriptEntry = useMutation(api.sessions.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)
  const checkSignOff = useAction(api.sessions.checkSignOff)
  const session = useAvatarSession()

  // Segments by id, kept for the whole session: a segment that keeps
  // sending after its final must not start over from nothing committed.
  const segments = useRef(new Map<string, Segment>())
  const latestId = useRef<string | null>(null)

  const commit = useCallback(
    (segment: Segment) => {
      if (segment.settle) clearTimeout(segment.settle)
      segment.settle = null
      const { next, line } = commitPending(segment.state)
      segment.state = next
      if (!line) return
      void (async () => {
        try {
          const result = await addTranscriptEntry({
            id: sessionId,
            entry: {
              speaker: character.id,
              speakerName: character.name,
              text: line.text,
              timestamp: Date.now(),
              spokenAt: line.spokenAt,
              type: "panelist",
            },
          })
          if (!result?.written) return
          decide({ sessionId }).catch((err) => console.error("orchestrator.decide failed:", err))
          checkSignOff({ sessionId }).catch((err) => console.error("sessions.checkSignOff failed:", err))
        } catch (err) {
          console.warn("transcript write failed, avatar turn dropped:", err)
        }
      })()
    },
    [addTranscriptEntry, checkSignOff, decide, sessionId, character.id, character.name]
  )

  // The audio stopped: the line in progress is finished being spoken.
  useEffect(() => {
    if (avatarSpeaking) return
    const timer = setTimeout(() => {
      const segment = latestId.current ? segments.current.get(latestId.current) : undefined
      if (segment) commit(segment)
    }, SPEECH_END_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [avatarSpeaking, commit])

  useTranscription(
    (entry) => {
      if (!isAvatarSpeech(entry)) return
      const segment: Segment = segments.current.get(entry.id) ?? { state: emptySegment(), settle: null }
      segments.current.set(entry.id, segment)
      latestId.current = entry.id
      segment.state = ingestText(segment.state, entry.text, Date.now())
      if (entry.final) {
        commit(segment)
        return
      }
      if (segment.settle) clearTimeout(segment.settle)
      segment.settle = setTimeout(() => commit(segment), FALLBACK_SETTLE_MS)
    },
    { interim: true }
  )

  // The avatar session can end while the room stays live (observed: GWM
  // sessions end themselves); stale segments must not leak into a
  // reconnected session's record or commit a line nobody is finishing.
  useEffect(() => {
    if (session.state !== "ended" && session.state !== "error") return
    for (const segment of segments.current.values()) {
      if (segment.settle) clearTimeout(segment.settle)
    }
    segments.current.clear()
    latestId.current = null
  }, [session.state])

  return null
}
