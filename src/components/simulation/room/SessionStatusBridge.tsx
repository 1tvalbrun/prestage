"use client"

import { useEffect } from "react"
import { useAvatar, useAvatarStatus, useLocalMedia } from "@runwayml/avatars-react"

// The avatar session's connection phases, surfaced so the room can detect
// a session that never produces an avatar (status stuck before "ready").
export type AvatarStatus =
  | "connecting"
  | "waiting"
  | "ready"
  | "ending"
  | "ended"
  | "error"

type SessionStatusBridgeProps = {
  onSpeakingChange: (speaking: boolean) => void
  onMicError: (error: Error | null) => void
  onAvatarStatus: (status: AvatarStatus) => void
}

export const SessionStatusBridge = ({
  onSpeakingChange,
  onMicError,
  onAvatarStatus,
}: SessionStatusBridgeProps) => {
  const { micError } = useLocalMedia()
  const { status } = useAvatarStatus()
  const { participant } = useAvatar()

  useEffect(() => {
    onMicError(micError)
  }, [micError, onMicError])

  useEffect(() => {
    onAvatarStatus(status)
  }, [status, onAvatarStatus])

  // Speaking comes from the avatar's audio level, which LiveKit tracks on
  // the remote participant. Transcript chunks were the signal before and
  // arrive in bursts with gaps mid-sentence, which read as silence (observed
  // live: a closing read cut off at a pause). Unmount resets the indicator
  // so a stale "speaking" never outlives the session it belonged to.
  useEffect(() => {
    if (!participant) return
    const handleSpeaking = (speaking: boolean) => onSpeakingChange(speaking)
    onSpeakingChange(participant.isSpeaking)
    participant.on("isSpeakingChanged", handleSpeaking)
    return () => {
      participant.off("isSpeakingChanged", handleSpeaking)
      onSpeakingChange(false)
    }
  }, [participant, onSpeakingChange])

  return null
}
