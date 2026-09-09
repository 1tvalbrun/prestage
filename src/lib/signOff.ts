import { bySpokenTime, spokenTime } from "./transcript.ts"

// The sign-off protocol's rules, modeled on a phone call: someone signs
// off, the other replies, the line drops. Detection is one model call
// (SIGN_OFF_PROMPT); everything here is pure so the room's behavior is
// testable without a session.

export type SignOffBy = "user" | "panelist" | "both"
export type SignOff = { by: SignOffBy; at: number; turnAt: number }
export type SignOffPhase = "none" | "waiting" | "drop"

// A user's goodbye with no reply at all from the avatar drops after this.
export const REPLY_WAIT_MAX_MS = 8_000
// Once the other party has started replying, the check on that reply
// upgrades the stamp (both) or clears it (they continued). This cap covers
// a reply that never classifies, such as noise with no final.
export const RECONCILE_MAX_MS = 15_000
// Heard within this = still speaking. Wide enough to cover a pause while
// reading and the second it takes a finished turn to classify.
export const USER_SPEECH_GAP_MS = 3_000
// "Ending the call" before the debrief. After the panelist's goodbye the
// ribbon is the user's window: it shows the moment the stamp lands and
// speaking retracts it, so every second of it is a chance to keep going.
// RIBBON_MAX_MS is the longest it holds for a speaker to finish.
export const RIBBON_MS = 3_500
// A closing read runs up to twenty seconds of speech; the cap only exists
// so a speaking signal stuck on can never hold the room forever.
export const RIBBON_MAX_MS = 45_000

type SignOffPhaseInput = {
  signOff: SignOff | undefined
  // Verdict lanes land only on the panelist: a user's "that's everything"
  // hands off to the closing read, it does not hang up.
  closingRead: boolean
  now: number
  avatarSpeaking: boolean
  // Start of the latest avatar speech, from the speaking signal.
  avatarSpokeAt: number | null
  userHeardAt: number | null
}

// A stamp is provisional until the other party answers: their goodbye
// makes it "both", anything else clears it (server-side, from the check on
// that reply). The room's job is to wait for that answer, and to drop when
// none comes.
export const signOffPhase = ({
  signOff,
  closingRead,
  now,
  avatarSpeaking,
  avatarSpokeAt,
  userHeardAt,
}: SignOffPhaseInput): SignOffPhase => {
  if (!signOff) return "none"
  if (closingRead && signOff.by === "user") return "none"
  if (signOff.by === "both") return "drop"
  const elapsed = now - signOff.at
  const replyStarted =
    signOff.by === "user"
      ? avatarSpokeAt !== null && avatarSpokeAt > signOff.turnAt
      : userHeardAt !== null && userHeardAt > signOff.turnAt
  if (replyStarted) return elapsed >= RECONCILE_MAX_MS ? "drop" : "waiting"
  if (signOff.by === "user") return elapsed >= REPLY_WAIT_MAX_MS ? "drop" : "waiting"
  return avatarSpeaking ? "waiting" : "drop"
}

// The ribbon's beat, held while a speaker is mid-line, never past the cap.
export const landAfterRibbon = (ribbonAt: number, now: number, avatarSpeaking: boolean): boolean => {
  const elapsed = now - ribbonAt
  if (elapsed >= RIBBON_MAX_MS) return true
  return elapsed >= RIBBON_MS && !avatarSpeaking
}

export const SIGN_OFF_PROMPT = `You are watching a live practice conversation between a USER and a PANELIST. The lines are numbered. Decide which lines, if any, are sign-offs.

A sign-off is a wrap-up, a final read on how the other did, a goodbye, "see you next time", "I have to go", "take care", or declining to continue, addressed to the other person as the end of THIS conversation. A short acknowledgment of the other person's goodbye ("Thank you, take care", "You too, bye", "Sounds good, bye now") is a sign-off too.

Not a sign-off: a goodbye that is quoted or narrated as part of a story or example, a greeting, "how are you doing today", thanking someone mid-conversation and continuing, or announcing that a final question is coming without ending afterward. A line that says the speaker has to go but then asks the other person a question, offers one last chance ("I need to get back to work, anything else?"), or echoes their goodbye as a question ("Goodbye? Did you want me to email you?") is not a sign-off either: the conversation is still going.

Answer with JSON only: {"signOffLines": [<line numbers>]}. Use [] when the conversation is still going.`

export type WindowLine = { type: "user" | "panelist"; text: string }

// The lines the check reads: the last eight turns spoken after any
// dismissal, plus the panelist's in-progress line last when the room sends
// one. Who spoke each line is ours to know, never the model's to guess.
export const signOffLines = (
  turns: { type: "user" | "panelist"; text: string; timestamp: number; spokenAt?: number }[],
  after: number | undefined,
  provisional: string | undefined
): WindowLine[] => {
  const lines: WindowLine[] = bySpokenTime(turns)
    .filter((turn) => after === undefined || spokenTime(turn) > after)
    .slice(provisional ? -7 : -8)
    .map((turn) => ({ type: turn.type, text: turn.text }))
  if (provisional) lines.push({ type: "panelist", text: provisional })
  return lines
}

export const renderWindow = (lines: WindowLine[]): string =>
  lines
    .map((line, i) => `${i + 1} ${line.type === "user" ? "USER" : "PANELIST"}: ${line.text}`)
    .join("\n")

// A reply this short to a goodbye is an acknowledgment ("You too, bye",
// "Alright. Take care."), whether or not the model flagged it.
const ACKNOWLEDGMENT_MAX_WORDS = 4

// A line that hands the floor back with a question ("I need to go, anything
// else?", "Goodbye? Want me to email you?") keeps the conversation going,
// whatever the model said about it.
const endsWithQuestion = (text: string): boolean => text.trim().endsWith("?")

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length

// Who signed off, from the flagged line numbers (1-based) and the structure
// of the last two lines. Only those two count: a goodbye that the other
// party talked past is not an ending, and a goodbye answered with a goodbye
// (or a short acknowledgment) is both.
export const resolveSignOff = (lines: WindowLine[], flagged: number[]): SignOffBy | null => {
  const last = lines.length
  if (last === 0) return null
  const lastLine = lines[last - 1]
  const previous = lines[last - 2]
  const isSignOff = (index: number) =>
    flagged.includes(index + 1) && !endsWithQuestion(lines[index].text)
  const previousByOther = previous !== undefined && previous.type !== lastLine.type
  if (previousByOther && isSignOff(last - 2)) {
    if (isSignOff(last - 1)) return "both"
    if (!endsWithQuestion(lastLine.text) && wordCount(lastLine.text) <= ACKNOWLEDGMENT_MAX_WORDS) {
      return "both"
    }
    return null
  }
  return isSignOff(last - 1) ? lastLine.type : null
}
