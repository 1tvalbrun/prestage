import {
  scopeText,
  type PackCopy,
  type PracticeVariant,
  type Scope,
  type ScopeField,
  type VerdictVocabulary,
} from "../types.ts"
import { OBJECTIONS } from "./objections.ts"

// The sales lane's two call types. A cold call is a stranger picking up
// the phone; a pitch meeting is the buyer who read your materials. The
// engine never sees these names; it reads salesVariant.

export const CALL_TYPE_KEY = "callType"
export const COLD_CALL_MINUTES = 2
export const COLD_CALL = "Cold call"
export const PITCH_MEETING = "Pitch meeting"

export const callTypeField: ScopeField = {
  key: CALL_TYPE_KEY,
  label: "What kind of call is this?",
  kind: "chips",
  required: true,
  options: [
    {
      value: "cold",
      label: COLD_CALL,
      hint: "They don't know you're calling. You get two minutes to earn more.",
    },
    {
      value: "pitch",
      label: PITCH_MEETING,
      hint: "They've read your materials and made time. Five minutes, then a verdict.",
    },
  ],
}

// The voice path extracts these; the typed form renders them after the
// call type. Shared with the pack's scopeFields so extraction and the
// pitch variant can never drift apart.
export const PITCH_INTAKE_FIELDS: ScopeField[] = [
  {
    key: "offering",
    label: "What you're selling",
    kind: "text",
    required: true,
    maxLength: 60,
    placeholder: "e.g. CourtFlow scheduling",
  },
  {
    key: "description",
    label: "What it does",
    kind: "textarea",
    required: true,
    maxLength: 600,
    placeholder: "What it does and the problem it removes, in a couple of lines",
  },
  {
    key: "prospect",
    label: "Who you're pitching",
    kind: "text",
    required: true,
    maxLength: 80,
    placeholder: "e.g. Facilities manager at a mid-size gym",
  },
  {
    key: "ask",
    label: "What you're asking them to say yes to",
    kind: "chips",
    options: [
      { value: "discovery", label: "A discovery call" },
      { value: "pilot", label: "A pilot" },
      { value: "paid-pilot", label: "A paid pilot" },
      { value: "partnership", label: "A partnership" },
      { value: "contract", label: "A signed contract" },
    ],
  },
  {
    key: "objections",
    label: "Objections you expect",
    kind: "multi",
    options: OBJECTIONS.map((objection) => ({
      value: objection.label,
      label: objection.label,
    })),
  },
]

export const PITCH_FIELDS: ScopeField[] = [callTypeField, ...PITCH_INTAKE_FIELDS]

export const COLD_FIELDS: ScopeField[] = [
  callTypeField,
  {
    key: "prospect",
    label: "Who are you calling?",
    kind: "text",
    required: true,
    maxLength: 80,
    placeholder: "e.g. Owner of a 12-truck HVAC company",
  },
  {
    key: "offering",
    label: "What do you sell?",
    kind: "text",
    required: true,
    maxLength: 60,
    placeholder: "e.g. Dispatch software for service fleets",
  },
  {
    key: "goal",
    label: "What do you want from this call?",
    kind: "chips",
    required: true,
    options: [
      { value: "meeting", label: "Book a meeting" },
      { value: "follow-up", label: "Permission to follow up" },
      { value: "close", label: "A yes on the spot" },
    ],
  },
]

export const PITCH_VERDICTS: VerdictVocabulary = {
  options: [
    { value: "buy", label: "Would buy", tone: "good" },
    { value: "second-meeting", label: "Second meeting", tone: "mid" },
    { value: "walk", label: "Would walk", tone: "bad" },
  ],
  fallback: "second-meeting",
}

export const COLD_VERDICTS: VerdictVocabulary = {
  options: [
    { value: "booked", label: "Booked", tone: "good" },
    { value: "follow-up", label: "Follow-up granted", tone: "mid" },
    { value: "brushed-off", label: "Brushed off", tone: "bad" },
  ],
  fallback: "follow-up",
}

export const pitchFormSections: PackCopy["form"]["sections"] = [
  { title: "The deal", keys: ["offering", "description", "prospect"] },
  { title: "The ask", keys: ["ask", "objections"] },
]

const coldFormSections: PackCopy["form"]["sections"] = [
  { title: "The call", keys: ["prospect", "offering", "goal"] },
]

export const pitchPreview: PackCopy["preview"] = {
  title: "What Cole will read",
  rows: [
    { key: "offering", label: "Selling", hint: "Not yet named" },
    { key: "description", label: "What it does", hint: "The problem it removes, in Cole's terms" },
    { key: "prospect", label: "Across the table", hint: "Who Cole is playing" },
  ],
  chips: { label: "Ask and objections", keys: ["ask", "objections"] },
  footer: "Only what you put here makes it in; gaps become questions, not guesses.",
}

export const pitchPanelLead =
  "The buyer reads your scope and materials before the room opens. Expect the objections you named, and a few you didn't."

const coldPanelLead =
  "Greg doesn't know you're calling and hasn't read a thing. He picks up, you talk, and he decides whether you get thirty seconds more."

export const isColdCall = (scope: Scope): boolean => scopeText(scope, CALL_TYPE_KEY) === COLD_CALL

export const salesVariant = (scope: Scope): PracticeVariant => {
  if (isColdCall(scope)) {
    return {
      scopeFields: COLD_FIELDS,
      prep: false,
      personaId: "prospect-01",
      roomMinutes: COLD_CALL_MINUTES,
      closingRead: false,
      remembers: false,
      verdicts: COLD_VERDICTS,
      copy: { formSections: coldFormSections, preview: null, panelLead: coldPanelLead },
    }
  }
  const chosen = scopeText(scope, CALL_TYPE_KEY) === PITCH_MEETING
  return {
    scopeFields: chosen ? PITCH_FIELDS : [callTypeField],
    prep: true,
    personaId: "buyer-01",
    roomMinutes: 5,
    closingRead: true,
    remembers: true,
    verdicts: PITCH_VERDICTS,
    copy: { formSections: pitchFormSections, preview: pitchPreview, panelLead: pitchPanelLead },
  }
}

// A booked cold call earns the meeting: prep it with Cole, with what the
// seller already typed carried over.
export const salesNextStep = (
  scope: Scope,
  verdict: string
): { label: string; scope: Scope } | null =>
  isColdCall(scope) && verdict === "booked"
    ? {
        label: "Prep the meeting with Cole",
        scope: {
          [CALL_TYPE_KEY]: PITCH_MEETING,
          offering: scopeText(scope, "offering"),
          prospect: scopeText(scope, "prospect"),
        },
      }
    : null
