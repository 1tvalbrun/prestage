import { BUYER_PERSONAS } from "./personas.ts"
import { firstNameOf, type DomainPack } from "../types.ts"
import { buildRoomBriefing, turnTaking } from "./briefing.ts"
import { analyzeSystem, analyzeUser, audit, debrief, extractScope, orchestrate } from "./prompts.ts"
import {
  CALL_TYPE_KEY,
  COLD_VERDICTS,
  PITCH_INTAKE_FIELDS,
  PITCH_VERDICTS,
  pitchFormSections,
  pitchPanelLead,
  pitchPreview,
  salesNextStep,
  salesVariant,
} from "./variant.ts"

export const salesPack: DomainPack = {
  id: "sales",
  label: "Pitch a sale",
  shortLabel: "Sales",
  startCta: "Start a sales practice",
  description:
    "Face the buyer before the real one. Cold-call a stranger who never asked to hear from you, or pitch the operator who read your materials, then get debriefed on whether the deal moved.",
  subjectField: "offering",
  subtitleFields: ["prospect", "ask"],
  userLabel: "SELLER",
  userTitle: "Seller",
  scopeFields: PITCH_INTAKE_FIELDS,
  contextFields: [
    { key: "coreOffer", label: "Core offer" },
    { key: "buyerProfile", label: "Buyer profile" },
    { key: "valueProposition", label: "Value proposition" },
    { key: "pricingShape", label: "Pricing shape" },
    { key: "riskiestAssumption", label: "Riskiest assumption" },
    { key: "likelyObjections", label: "Likely objections" },
    { key: "openQuestions", label: "Open questions" },
  ],
  verdicts: {
    options: [...PITCH_VERDICTS.options, ...COLD_VERDICTS.options],
    fallback: PITCH_VERDICTS.fallback,
  },
  sessionMetaField: CALL_TYPE_KEY,
  variantField: CALL_TYPE_KEY,
  variant: salesVariant,
  nextStep: salesNextStep,
  prep: {
    kind: "audit",
    stepLabel: "Pre-read",
    // Only the pitch meeting has prep, and it locks the buyer.
    start: {
      label: "Run the pre-read",
      hint: `${firstNameOf(BUYER_PERSONAS[0].name)} reads everything before the first question.`,
    },
    prompt: audit,
    wait: {
      kicker: "The audit · before the buyer pushes",
      heading: (subject) => `Reading ${subject} the way a buyer would.`,
      lead: "We check every claim for backing, and note everything a skeptical buyer will ask for.",
      rows: [
        { label: "Claims", text: "Pulling out every claim you've made…" },
        { label: "Citations", text: "Tracing each one back to a page…" },
        { label: "Evidence", text: "Checking what's actually backed…" },
        { label: "Omissions", text: "Finding what a buyer expects and can't see…" },
        { label: "Severity", text: "Sorting deal-stallers from soft spots…" },
        { label: "Coverage", text: "Weighing value, fit, objections, the close…" },
      ],
      work: [
        "Reading your materials",
        "Extracting stated claims",
        "Verifying each against a source",
        "Assembling the gap map",
        "Mapping the pressure points",
      ],
      ticker: [
        "Every claim has to trace to a source.",
        "If it can't be cited, it becomes a gap.",
        "Gaps are what the buyer presses on first.",
        "This is the read before a single question.",
      ],
      stepMs: 2000,
    },
    copy: {
      kicker: "The audit · before the buyer pushes",
      readyHeading: "Here's what we found, and what's missing.",
      readyLead:
        "Read straight from your materials before a single question. Every gap below is something a real buyer will find. The tough ones come up first.",
      zeroClaims: "That's the finding: the buyer will treat everything as unproven.",
      cta: "Take it to the buyer",
    },
  },
  copy: {
    tellIt: {
      heading: "What are you selling?",
      sub: "Talk through what you're selling, who's across the table, and what you're asking them to say yes to. It gets shaped into a brief you'll confirm.",
    },
    form: {
      sections: pitchFormSections,
      materialsTitle: "Materials",
      materialsMeta: "optional · PDF PPTX XLSX DOCX",
      materialsPrompt: "Add your documents.",
    },
    preview: pitchPreview,
    readWait: {
      kicker: "Reading your pitch",
      heading: () => "Going through what you gave us.",
      lead: "The buyer's brief is built from every line you wrote. This takes a few seconds.",
      rows: [
        { label: "Offering", text: "Registering what you're selling…" },
        { label: "What it does", text: "Reading the shape of the offer…" },
        { label: "The prospect", text: "Working out who's across the table…" },
        { label: "The ask", text: "Pinning down what a yes looks like…" },
        { label: "Objections", text: "Lining up the pushback you expect…" },
      ],
      work: [
        "Parsing your scope",
        "Profiling the buyer",
        "Weighing the value story",
        "Naming the riskiest assumption",
        "Drafting the open questions",
      ],
      ticker: [
        "We only work with what you actually gave us.",
        "Nothing gets invented. If we didn't catch it, we ask.",
        "A gap is a finding, not a failure.",
        "The buyer reads this before you walk in.",
      ],
      stepMs: 1250,
    },
    panel: {
      kicker: "Meet your buyer",
      heading: "Who's across the table?",
      lead: pitchPanelLead,
    },
    promptHelpers: [
      "The problem this removes is…",
      "Compared to what you do today…",
      "Here's what month three looks like…",
      "What I'd like to walk away with…",
    ],
  },
  personas: BUYER_PERSONAS,
  turnTaking,
  briefing: buildRoomBriefing,
  prompts: { analyzeSystem, analyzeUser, orchestrate, debrief, extractScope },
}
