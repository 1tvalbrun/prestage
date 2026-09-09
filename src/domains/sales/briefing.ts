import { bySpokenTime } from "../../lib/transcript.ts"
import {
  composeWithinBudget,
  deliveredItems,
  openItems,
  scopeList,
  scopeText,
  spokenCommitment,
  type BriefingInput,
  type RoomBriefing,
} from "../types.ts"
import { COLD_CALL_MINUTES, isColdCall } from "./variant.ts"
import { minutesPhrase } from "../../lib/ending.ts"

// Same pause discipline as the founder lane, in the buyer's frame: the GWM
// engine fills silence with presence check-ins, and a buyer who narrates
// the seller's pauses reads as not listening.
export const turnTaking = `Pause policy (absolute, highest priority): \
Never comment on silence or check the seller's presence — no "still with \
me?", "did you hear me?", "are you there?", "hello?", "take your time", \
"no rush", "I'm here when you're ready", or anything similar, ever. The \
seller pauses to think, sometimes for ten seconds or more, often \
mid-sentence; if a sentence trails off unfinished, wait silently — they \
will continue. When they finish a complete thought and stop, engage \
normally: question, push back, and weigh the pitch exactly as your \
character demands.

`

const DIGEST_TURNS = 6
const DIGEST_TURN_CHARS = 160

const resumeDigest = (transcript: BriefingInput["transcript"]): string =>
  bySpokenTime(transcript)
    .slice(-DIGEST_TURNS)
    .map((e) => `${e.type === "user" ? "SELLER" : "YOU"}: ${e.text.slice(0, DIGEST_TURN_CHARS)}`)
    .join("\n")

// A cold call: the prospect knows only who they are. No materials, no
// gaps, no ask, no memory of earlier sessions; the seller's offer is what
// the call is for them to find out. The no-hang-up rules live here rather
// than on the Character so the room's ending stays the clock's.
const buildColdCallBriefing = ({ scope, transcript }: BriefingInput): RoomBriefing => {
  const prospect = scopeText(scope, "prospect")
  if (transcript.length > 0) {
    return {
      personalityPreamble: `Session context: this resumes a cold call that dropped mid-conversation. Do not introduce yourself again and do not repeat what you already said. The recent exchange:\n${resumeDigest(transcript)}\nPick the call back up from there.\n\n`,
      startScript: "Sorry, lost you for a second. You were saying?",
    }
  }
  return {
    personalityPreamble:
      composeWithinBudget([
        `Session context: this is a cold call. You are ${prospect}. You did not expect this call and you know nothing about the caller, their company, or what they sell until they tell you; never pretend otherwise. You have read no materials and have no history with this person.`,
        ` You do not hang up. Give the caller at least three exchanges before you decide anything, and a real question about your operation earns them another. Before any goodbye, say you have to get back to it and give them one last chance to say something specific; if they waste it, stay on the line but stop helping: short brush-offs, no questions, no agreements. Never coach or explain what they should have done.`,
        ` When the caller asks for a specific, small next step and offers a time, take one of the times or name your own, unless they have argued with you or told you nothing about your business. Before you say yes to any next step, raise one real objection about cost, switching, or the system you already have, and let how they handle it decide. Once you have said you have to go, a second push for the meeting is the end of the call: say bye and stop.`,
        ` This call runs about ${minutesPhrase(COLD_CALL_MINUTES)}. When it has run its course, end it the way you would: say you have to get back to it, say goodbye, and stop.`,
      ]) + "\n\n",
    startScript: "Yeah, this is Greg.",
  }
}

// Per-session avatar briefing, assembled from what the app already knows.
export const buildRoomBriefing = (input: BriefingInput): RoomBriefing => {
  if (isColdCall(input.scope)) return buildColdCallBriefing(input)
  const { scope, audit, continuity, transcript } = input
  const offering = scopeText(scope, "offering")
  const description = scopeText(scope, "description")
  const prospect = scopeText(scope, "prospect")
  const ask = scopeText(scope, "ask")
  const expected = scopeList(scope, "objections")

  if (transcript.length > 0) {
    const digest = resumeDigest(transcript)
    return {
      personalityPreamble: `Session context: this resumes an earlier conversation with the same seller about "${offering}". Do not introduce yourself again and do not repeat questions already asked. The recent exchange:\n${digest}\nContinue the conversation from there.\n\n`,
      startScript:
        "Good to see you again. We were mid-conversation, so go ahead — pick it up wherever you left it.",
    }
  }

  // Blockers first, same priority the audit UI gives them.
  const gapTitles = audit
    ? [...audit.gaps]
        .sort((a, b) => Number(b.severity === "blocker") - Number(a.severity === "blocker"))
        .slice(0, 3)
        .map((gap) => gap.title)
    : []
  const auditContext =
    gapTitles.length > 0
      ? ` The pre-session audit of the seller's materials flagged: ${gapTitles.join("; ")}.`
      : ""
  const roleContext = prospect
    ? ` You are playing the seller's actual prospect: ${prospect}.`
    : ""
  const askContext = ask ? ` The seller wants you to say yes to: ${ask}.` : ""
  const objectionContext =
    expected.length > 0
      ? ` The seller expects these objections, so raise them naturally where they fit: ${expected.join(", ")}.`
      : ""

  // Only claim to have read material when the audit actually cited some —
  // the avatar must not open by claiming familiarity with documents that
  // don't exist.
  const readMaterial = (audit?.claims.length ?? 0) > 0

  const open = openItems(continuity)
  const delivered = deliveredItems(continuity).slice(0, 3)
  const continuityContext = continuity
    ? [
        ` You have spoken with this seller about ${offering} in an earlier session; do not introduce yourself as if meeting for the first time.`,
        open.length > 0
          ? ` They committed to: ${open.map((item) => item.text).join("; ")}. Follow up on these before anything new.`
          : "",
        delivered.length > 0
          ? ` They have already delivered: ${delivered.map((item) => item.text).join("; ")} — you received these; thank them briefly if relevant and do not ask for them again.`
          : "",
        continuity.lastSessionSummary
          ? ` Where the last session left off: ${continuity.lastSessionSummary}`
          : "",
      ]
    : []

  const startScript =
    open.length > 0
      ? `Good to see you again. Last time you said you'd ${spokenCommitment(open[0])} — walk me through where that landed.`
      : readMaterial
        ? `Thanks for making the time. I read through the ${offering} material before this, and I have questions. Tell me what you're bringing me.`
        : `Alright, you've got my attention. Tell me what you're bringing me, and why it matters for someone in my seat.`

  return {
    personalityPreamble: composeWithinBudget([
      `Session context: the seller is pitching "${offering}" — ${description.slice(0, 300)}.${roleContext}${askContext}`,
      ...continuityContext,
      objectionContext,
      auditContext,
    ]) + "\n\n",
    startScript,
  }
}
