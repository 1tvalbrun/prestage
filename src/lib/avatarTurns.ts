// Turn boundaries for the avatar's transcript, kept out of the room so the
// rule is testable. Runway's data channel replays every avatar line under
// one segment id with cumulative text (observed 2026-09-23: the payload's
// turn counter stopped incrementing, so the SDK never emits a final), so a
// line is whatever arrived since the last commit, and its onset is when
// that first new chunk arrived. A per-turn segment (one line per id) is the
// same rule with a single commit.

export type SegmentState = {
  // The segment's cumulative text as last reported.
  text: string
  // How much of it is already on the record.
  committedLength: number
  // When the first chunk beyond committedLength arrived; null until it does.
  segmentStartedAt: number | null
}

export const emptySegment = (): SegmentState => ({ text: "", committedLength: 0, segmentStartedAt: null })

// A cumulative chunk. A segment whose text shrinks has been reset upstream,
// so nothing of it counts as committed any more.
export const ingestText = (state: SegmentState, text: string, now: number): SegmentState => {
  const committedLength = text.length < state.committedLength ? 0 : state.committedLength
  const hasNewText = text.slice(committedLength).trim().length > 0
  const segmentStartedAt = state.segmentStartedAt ?? (hasNewText ? now : null)
  return { text, committedLength, segmentStartedAt }
}

export const pendingText = (state: SegmentState): string => state.text.slice(state.committedLength).trim()

// The line spoken since the last commit, or null when nothing new is on
// the wire; the returned state has that line marked committed.
export const commitPending = (
  state: SegmentState
): { next: SegmentState; line: { text: string; spokenAt: number } | null } => {
  const text = pendingText(state)
  if (text.length === 0 || state.segmentStartedAt === null) return { next: state, line: null }
  return {
    next: { text: state.text, committedLength: state.text.length, segmentStartedAt: null },
    line: { text, spokenAt: state.segmentStartedAt },
  }
}
