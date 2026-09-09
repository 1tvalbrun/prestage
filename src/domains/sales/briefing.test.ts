import test from "node:test"
import assert from "node:assert/strict"
import { buildRoomBriefing } from "./briefing.ts"
import type { Claim, Gap } from "../../lib/audit.ts"
import { CALL_TYPE_KEY, COLD_CALL } from "./variant.ts"

const scope = {
  offering: "CourtFlow",
  description: "Scheduling for shared gym space",
  prospect: "Facilities manager at a mid-size gym",
  ask: "A pilot",
  objections: ["Switching cost"],
}

const gap = (title: string, severity: Gap["severity"] = "blocker"): Gap => ({
  severity,
  kind: "absent",
  title,
  detail: "detail",
})

const claim = (): Claim => ({
  text: "claim",
  citation: { source: "one-pager.pdf", location: "page 1" },
})

test("a fresh session casts the avatar as the prospect and carries the ask", () => {
  const briefing = buildRoomBriefing({ scope, audit: null, continuity: null, transcript: [] })
  assert.match(briefing.personalityPreamble, /Facilities manager at a mid-size gym/)
  assert.match(briefing.personalityPreamble, /say yes to: A pilot/)
  assert.match(briefing.personalityPreamble, /Switching cost/)
  assert.match(briefing.startScript, /you've got my attention/i)
})

test("a fresh session with citable material earns the material clause and carries the gaps", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: {
      claims: [claim()],
      gaps: [gap("No pricing anywhere"), gap("No references", "gap")],
    },
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.startScript, /read through the CourtFlow material/)
  assert.match(briefing.personalityPreamble, /No pricing anywhere/)
  assert.match(briefing.personalityPreamble, /CourtFlow/)
})

test("a resume never re-introduces and digests turns in speech order", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    continuity: null,
    transcript: [
      { text: "Answer about rollout", type: "user", timestamp: 2000, spokenAt: 5000 },
      { text: "How long does rollout take?", type: "panelist", timestamp: 1000, spokenAt: 1000 },
    ],
  })
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  const questionAt = briefing.personalityPreamble.indexOf("How long does rollout take?")
  const answerAt = briefing.personalityPreamble.indexOf("Answer about rollout")
  assert.ok(questionAt !== -1 && answerAt !== -1 && questionAt < answerAt)
  assert.match(briefing.startScript, /pick it up wherever you left it/)
})

test("a session with no expected objections stays silent about them", () => {
  const briefing = buildRoomBriefing({
    scope: { ...scope, objections: [] },
    audit: null,
    continuity: null,
    transcript: [],
  })
  assert.doesNotMatch(briefing.personalityPreamble, /raise them naturally/)
})

test("an audit with nothing citable never claims to have read material", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: { claims: [], gaps: [gap("No customer references")] },
    continuity: null,
    transcript: [],
  })
  assert.match(briefing.startScript, /you've got my attention/i)
  assert.doesNotMatch(briefing.startScript, /read through/)
})

const continuity = {
  lastSessionSummary: "Pilot terms agreed in principle; integration proof outstanding.",
  actionItems: [
    {
      id: "r1:0",
      text: "Send two customer references",
      priority: "high" as const,
      status: "open" as const,
      createdAt: 1,
    },
    {
      id: "r1:1",
      text: "Deliver the security summary",
      priority: "medium" as const,
      status: "done" as const,
      createdAt: 2,
    },
  ],
  updatedAt: 2,
}

test("open commitments drive the opener and forbid re-introduction", () => {
  const briefing = buildRoomBriefing({ scope, audit: null, continuity, transcript: [] })
  assert.match(briefing.startScript, /Last time you said you'd send two customer references/)
  assert.match(briefing.personalityPreamble, /do not introduce yourself/i)
  assert.match(briefing.personalityPreamble, /already delivered: Deliver the security summary/)
  assert.match(briefing.personalityPreamble, /integration proof outstanding/)
})

test("continuity without open items keeps the standard opener but carries the memory", () => {
  const briefing = buildRoomBriefing({
    scope,
    audit: null,
    continuity: {
      ...continuity,
      actionItems: continuity.actionItems.filter((item) => item.status !== "open"),
    },
    transcript: [],
  })
  assert.match(briefing.startScript, /you've got my attention/i)
  assert.match(briefing.personalityPreamble, /do not introduce yourself/i)
})

const coldScope = {
  [CALL_TYPE_KEY]: COLD_CALL,
  prospect: "Owner of a 12-truck HVAC company",
  offering: "Dispatch software for service fleets",
  goal: "Book a meeting",
}

test("a cold call casts the avatar as the prospect and tells them nothing about the caller", () => {
  const briefing = buildRoomBriefing({ scope: coldScope, audit: null, continuity: null, transcript: [] })
  assert.match(briefing.personalityPreamble, /Owner of a 12-truck HVAC company/)
  assert.doesNotMatch(briefing.personalityPreamble, /Dispatch software/)
  assert.doesNotMatch(briefing.personalityPreamble, /Book a meeting/)
  assert.match(briefing.personalityPreamble, /cold call/i)
  assert.match(briefing.personalityPreamble, /do not hang up/i)
  assert.match(briefing.personalityPreamble, /about two minutes/)
  assert.match(briefing.personalityPreamble, /at least three exchanges/)
  assert.match(briefing.personalityPreamble, /one last chance/)
  // A clean ask with a time wins; a push past a goodbye never does.
  assert.match(briefing.personalityPreamble, /take one of the times or name your own/)
  assert.match(briefing.personalityPreamble, /raise one real objection/)
  assert.match(briefing.personalityPreamble, /second push for the meeting is the end of the call/)
  assert.doesNotMatch(briefing.startScript, /minute/)
  assert.match(briefing.startScript, /this is Greg/)
})

test("a cold call ignores audit and continuity: a stranger has read nothing and remembers nothing", () => {
  const briefing = buildRoomBriefing({
    scope: coldScope,
    audit: { claims: [claim()], gaps: [gap("No pricing anywhere")] },
    continuity: { lastSessionSummary: "Went well", actionItems: [], updatedAt: 0 },
    transcript: [],
  })
  assert.doesNotMatch(briefing.personalityPreamble, /No pricing anywhere/)
  assert.doesNotMatch(briefing.personalityPreamble, /earlier session/)
  assert.doesNotMatch(briefing.startScript, /read through/)
})

test("a resumed cold call picks the call back up without a re-introduction", () => {
  const briefing = buildRoomBriefing({
    scope: coldScope,
    audit: null,
    continuity: null,
    transcript: [
      { text: "Hi Greg, this is Dana from FleetPath.", type: "user", timestamp: 1 },
      { text: "What's this about?", type: "panelist", timestamp: 2 },
    ],
  })
  assert.match(briefing.personalityPreamble, /What's this about\?/)
  assert.match(briefing.personalityPreamble, /Do not introduce yourself again/)
  assert.doesNotMatch(briefing.startScript, /this is Greg/)
})
