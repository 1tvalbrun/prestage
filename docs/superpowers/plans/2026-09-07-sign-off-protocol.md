# Sign-off Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lane's room ends the way a phone call does: someone signs off, the other replies, a three-second ribbon, the debrief. Plus the cold-call time-up hold, the connect abort fix, and the connect timer cosmetics.

**Architecture:** One lane-blind sign-off check (a fast model call over the last eight turns) stamps `session.signOff`. The room turns that stamp into a landing through pure rules in `src/lib/signOff.ts`, with a policy per variant (`closingRead`). The panelist's in-progress line is checked the moment they stop speaking so their goodbye is not a turn late. The closing-read detector is retired into this one.

**Tech Stack:** Next.js 16 client components, Convex actions and mutations, OpenAI fast tier, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-07-sign-off-protocol-design.md`

## Global Constraints

- No semicolons. Const arrow functions. `Handle` prefix on event handlers. Early returns.
- Every public Convex function keeps `requireIdentity` and ownership checks.
- No TODOs or placeholders. No em dashes in copy, prompts, or comments.
- **Never commit.** Each "stop for review" leaves work in the tree.
- Verification: `pnpm test`, `npx tsc --noEmit -p .`, `pnpm lint`, `npx convex dev --once`.
- The evaluation script spends real OpenAI credit (cents). Run it once per prompt change, not per test run.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/signOff.ts` (create) | Prompt, window builder, landing rules, constants. Pure. |
| `src/lib/signOff.test.ts` (create) | Rules and window tests. |
| `src/lib/roomClock.ts` (modify) | `shouldLandOnTime`, `TIME_HOLD_MAX_MS`, `COLD_CALL_CUE`; remove `shouldLandAfterClose`, `CLOSE_LAND_GRACE_MS`. |
| `src/lib/ending.ts` (modify) | Remove `CLOSE_CHECK_PROMPT`, `closeCheckWindow`. |
| `convex/schema.ts` (modify) | `signOff`, `signOffDismissedAt`, `connectMs`; `endedReason` gains `goodbye`. |
| `convex/sessions.ts` (modify) | `checkSignOff` action, `markSignOff`, `dismissSignOff`, `markRoomStarted(connectMs)`, verified reasons. |
| `convex/orchestrator.ts` (modify) | Drop the close check. |
| `src/app/api/avatar/connect/route.ts` (modify) | 250 ms poll, `connectMs`. |
| `src/components/simulation/room/TranscriptBridge.tsx` (modify) | Provisional check on avatar settle, final check fallback. |
| `src/components/simulation/room/UserSpeechBridge.tsx` (modify) | Check after each user final. |
| `src/components/simulation/room/RoomShell.tsx` (modify) | Sign-off landing, ribbon, time-up hold, cold cue, connect abort retry, clock anchors. |
| `src/domains/types.ts`, `src/domains/registry.ts`, `src/domains/sales/variant.ts` (modify) | `copy.actionItemsFooter`. |
| `src/domains/sales/briefing.ts` (modify) | Budget line in the cold briefing. |
| `src/app/(app)/p/[practiceId]/s/[sessionId]/page.tsx` (modify) | Footer copy from the variant. |
| `scripts/eval-signoff.ts`, `scripts/fixtures/signoff.json` (create) | Offline evaluation. |

---

### Task 1: Pure rules and prompt (`src/lib/signOff.ts`)

- [ ] **Step 1: Failing tests** in `src/lib/signOff.test.ts`:

```ts
import test from "node:test"
import assert from "node:assert/strict"
import {
  REPLY_WAIT_MAX_MS,
  RIBBON_MS,
  USER_REPLY_WINDOW_MS,
  USER_SPEECH_GAP_MS,
  SIGN_OFF_PROMPT,
  landAfterRibbon,
  signOffPhase,
  signOffWindow,
} from "./signOff.ts"

const T0 = 1_000_000
const base = {
  closingRead: false,
  now: T0 + 1_000,
  avatarSpeaking: false,
  avatarSpokeAt: null,
  userHeardAt: null,
}

test("no sign-off, or a user sign-off in a verdict lane, never lands", () => {
  assert.equal(signOffPhase({ ...base, signOff: undefined }), "none")
  assert.equal(
    signOffPhase({ ...base, closingRead: true, signOff: { by: "user", at: T0, turnAt: T0 } }),
    "none"
  )
})

test("both said goodbye: drop at once", () => {
  assert.equal(signOffPhase({ ...base, signOff: { by: "both", at: T0, turnAt: T0 } }), "drop")
})

test("user signed off: wait for the avatar's reply to start after the goodbye and finish", () => {
  const signOff = { by: "user" as const, at: T0, turnAt: T0 - 2_000 }
  assert.equal(signOffPhase({ ...base, signOff }), "waiting")
  // Reply started before the goodbye turn: not a reply.
  assert.equal(signOffPhase({ ...base, signOff, avatarSpokeAt: T0 - 5_000 }), "waiting")
  // Reply in progress.
  assert.equal(signOffPhase({ ...base, signOff, avatarSpokeAt: T0 - 1_000, avatarSpeaking: true }), "waiting")
  // Reply finished, including one that finished before the stamp arrived.
  assert.equal(signOffPhase({ ...base, signOff, avatarSpokeAt: T0 - 1_000 }), "drop")
  // No reply ever: the cap drops it.
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + REPLY_WAIT_MAX_MS }), "drop")
})

test("panelist signed off: give the user a window, extend while they speak, then drop", () => {
  const signOff = { by: "panelist" as const, at: T0, turnAt: T0 }
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + USER_REPLY_WINDOW_MS - 1 }), "waiting")
  assert.equal(signOffPhase({ ...base, signOff, now: T0 + USER_REPLY_WINDOW_MS }), "drop")
  const speaking = T0 + USER_REPLY_WINDOW_MS + 500
  assert.equal(
    signOffPhase({ ...base, signOff, now: speaking, userHeardAt: speaking - USER_SPEECH_GAP_MS + 1 }),
    "waiting"
  )
  assert.equal(
    signOffPhase({ ...base, signOff, now: speaking, avatarSpeaking: true }),
    "waiting"
  )
  // The cap wins over an avatar that keeps talking.
  assert.equal(
    signOffPhase({ ...base, signOff, now: T0 + REPLY_WAIT_MAX_MS, avatarSpeaking: true }),
    "drop"
  )
})

test("verdict lanes land on the panelist's sign-off with the same window", () => {
  const signOff = { by: "panelist" as const, at: T0, turnAt: T0 }
  assert.equal(signOffPhase({ ...base, closingRead: true, signOff, now: T0 + USER_REPLY_WINDOW_MS }), "drop")
})

test("the ribbon holds for its beat, then lands", () => {
  assert.equal(landAfterRibbon(T0, T0 + RIBBON_MS - 1), false)
  assert.equal(landAfterRibbon(T0, T0 + RIBBON_MS), true)
})

test("the window is the last eight turns after a dismissal, labeled, with the provisional line last", () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({
    type: (i % 2 === 0 ? "panelist" : "user") as "panelist" | "user",
    text: `turn ${i}`,
    timestamp: T0 + i * 1_000,
  }))
  const lines = signOffWindow(turns, undefined, undefined).split("\n")
  assert.equal(lines.length, 8)
  assert.equal(lines[0], "PANELIST: turn 2")
  assert.equal(lines[7], "USER: turn 9")
  const after = signOffWindow(turns, T0 + 6_500, "have a good day").split("\n")
  assert.deepEqual(after, ["USER: turn 7", "PANELIST: turn 8", "USER: turn 9", "PANELIST: have a good day"])
})

test("the prompt asks the one question and excludes look-alikes", () => {
  for (const marker of ['"signOff"', "quoted", "greeting", "final question", "both"]) {
    assert.ok(SIGN_OFF_PROMPT.toLowerCase().includes(marker.toLowerCase()), `missing: ${marker}`)
  }
})
```

- [ ] **Step 2: Run** `node --test src/lib/signOff.test.ts`: FAIL, module not found.

- [ ] **Step 3: Implement** `src/lib/signOff.ts`:

```ts
import { bySpokenTime, spokenTime } from "./transcript.ts"

// The sign-off protocol's rules, modeled on a phone call: someone signs
// off, the other replies, the line drops. Detection is one model call
// (SIGN_OFF_PROMPT); everything here is pure so the room's behavior is
// testable without a session.

export type SignOffBy = "user" | "panelist" | "both"
export type SignOff = { by: SignOffBy; at: number; turnAt: number }
export type SignOffPhase = "none" | "waiting" | "drop"

// Cap on waiting for the other party's reply.
export const REPLY_WAIT_MAX_MS = 8_000
// The user's chance to say goodbye after the panelist's.
export const USER_REPLY_WINDOW_MS = 4_000
// Heard within this = still speaking.
export const USER_SPEECH_GAP_MS = 1_500
// "Ending the call" before the debrief.
export const RIBBON_MS = 3_000

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
  if (now - signOff.at >= REPLY_WAIT_MAX_MS) return "drop"
  if (signOff.by === "user") {
    // The reply may have finished before the stamp arrived; what matters is
    // that it started after the goodbye turn and is over.
    const replied = avatarSpokeAt !== null && avatarSpokeAt > signOff.turnAt && !avatarSpeaking
    return replied ? "drop" : "waiting"
  }
  const userSpeaking = userHeardAt !== null && now - userHeardAt < USER_SPEECH_GAP_MS
  if (now - signOff.at < USER_REPLY_WINDOW_MS || userSpeaking || avatarSpeaking) return "waiting"
  return "drop"
}

export const landAfterRibbon = (ribbonAt: number, now: number): boolean =>
  now - ribbonAt >= RIBBON_MS

export const SIGN_OFF_PROMPT = `You are watching a live practice conversation between a USER and a PANELIST. Decide one thing: has either of them signed off, ending the conversation?

A sign-off is a wrap-up, a final read on how the other did, a goodbye, "see you next time", "I have to go", or declining to continue, addressed to the other person as the end of THIS conversation. The most recent lines matter most.

Not a sign-off: a goodbye that is quoted or narrated as part of a story or example, a greeting, "how are you doing today", thanking someone mid-conversation and continuing, or announcing that a final question is coming without ending afterward.

Answer with JSON only: {"signOff": "user" | "panelist" | "both" | "none"}
"user": only the user signed off. "panelist": only the panelist signed off. "both": each has said their goodbye. "none": the conversation is still going.`

// The exact window shape the prompt is evaluated against: the last eight
// turns spoken after any dismissal, USER/PANELIST labels, and the
// panelist's in-progress line last when the room sends one.
export const signOffWindow = (
  turns: { type: "user" | "panelist"; text: string; timestamp: number; spokenAt?: number }[],
  after: number | undefined,
  provisional: string | undefined
): string => {
  const lines = bySpokenTime(turns)
    .filter((turn) => after === undefined || spokenTime(turn) > after)
    .slice(provisional ? -7 : -8)
    .map((turn) => (turn.type === "user" ? `USER: ${turn.text}` : `PANELIST: ${turn.text}`))
  if (provisional) lines.push(`PANELIST: ${provisional}`)
  return lines.join("\n")
}
```

`spokenTime` is exported from `src/lib/transcript.ts` already; check and export if not.

- [ ] **Step 4: Run** the test: PASS. Typecheck.

---

### Task 2: Room clock: time-up hold and the cold cue

- [ ] **Step 1: Tests** in `src/lib/roomClock.test.ts`. Replace the `shouldLandAfterClose` test with:

```ts
test("time-up in a verdict lane keeps today's rule: resolving or over, and the persona quiet or the floor reached", () => {
  const rule = (elapsed: number, avatarSpeaking: boolean) =>
    shouldLandOnTime({ elapsed, roomMs: ROOM_MS, closingRead: true, avatarSpeaking, userSpeaking: false })
  assert.equal(rule(ROOM_MS - RESOLVE_MS - 1, false), false)
  assert.equal(rule(ROOM_MS - RESOLVE_MS, false), true)
  assert.equal(rule(ROOM_MS - RESOLVE_MS, true), false)
  assert.equal(rule(ROOM_MS - 2_000, true), true)
})

test("time-up without a closing read waits for both voices, then the hold cap lands it regardless", () => {
  const rule = (elapsed: number, avatarSpeaking: boolean, userSpeaking: boolean) =>
    shouldLandOnTime({ elapsed, roomMs: 120_000, closingRead: false, avatarSpeaking, userSpeaking })
  assert.equal(rule(120_000 - 1, false, false), false)
  assert.equal(rule(120_000, false, false), true)
  assert.equal(rule(120_000, false, true), false)
  assert.equal(rule(120_000, true, false), false)
  assert.equal(rule(120_000 + TIME_HOLD_MAX_MS - 1, true, true), false)
  assert.equal(rule(120_000 + TIME_HOLD_MAX_MS, true, true), true)
})
```

Update the import line to `shouldLandOnTime, TIME_HOLD_MAX_MS` and drop `shouldLandAfterClose, CLOSE_LAND_GRACE_MS`.

- [ ] **Step 2: Implement** in `src/lib/roomClock.ts`. Remove `CLOSE_LAND_GRACE_MS` and `shouldLandAfterClose`. Add:

```ts
// Past the budget, a room without a closing read holds for whoever is
// mid-sentence and the reply, then lands; the cap answers the caller who
// never stops.
export const TIME_HOLD_MAX_MS = 20_000
// The wind-down line for a room without a closing read; the invitations
// presume a panelist with a read to deliver.
export const COLD_CALL_CUE = "Ask for the next step."

type TimeUpInput = {
  elapsed: number
  roomMs: number
  closingRead: boolean
  avatarSpeaking: boolean
  userSpeaking: boolean
}

export const shouldLandOnTime = ({
  elapsed,
  roomMs,
  closingRead,
  avatarSpeaking,
  userSpeaking,
}: TimeUpInput): boolean => {
  if (closingRead) {
    // The persona's close is never cut by our clock except at the floor.
    const reached = elapsed >= roomMs - RESOLVE_MS
    const atFloor = elapsed >= roomMs - 2_000
    return reached && (!avatarSpeaking || atFloor)
  }
  if (elapsed >= roomMs + TIME_HOLD_MAX_MS) return true
  return elapsed >= roomMs && !avatarSpeaking && !userSpeaking
}
```

- [ ] **Step 3:** Remove `CLOSE_CHECK_PROMPT` and `closeCheckWindow` from `src/lib/ending.ts` and their test from `src/lib/ending.test.ts`. Run `node --test src/lib/roomClock.test.ts src/lib/ending.test.ts`: PASS. (Typecheck fails until Task 3 and Task 5 remove the callers; that is expected.)

---

### Task 3: Server: schema, check action, stamps, reasons, connect time

- [ ] **Step 1: Schema** (`convex/schema.ts`):

```ts
export const endedReasonValidator = v.union(
  v.literal("verdict"), // the panelist signed off (closing read or goodbye) and the room landed on it
  v.literal("goodbye"), // the user signed off (or both did) and the room landed on it
  v.literal("time"),
  v.literal("user"),
  v.literal("idle"),
  v.literal("error")
)
```

In `sessions`, replace the `closeDeliveredAt` comment and add the fields:

```ts
    // Retired 2026-09-07 in favor of signOff; kept optional for documents
    // written before then. Never written or read.
    closeDeliveredAt: v.optional(v.number()),
    // The sign-off protocol's stamp (sessions.checkSignOff, first wins):
    // who signed off, when the stamp landed, and the spoken time of the
    // last turn the check saw, so the room can tell a reply that already
    // happened from one still to come.
    signOff: v.optional(
      v.object({
        by: v.union(v.literal("user"), v.literal("panelist"), v.literal("both")),
        at: v.number(),
        turnAt: v.number(),
      })
    ),
    // "Keep going" on the ribbon: the check ignores everything spoken
    // before this, so the same goodbye cannot re-stamp.
    signOffDismissedAt: v.optional(v.number()),
    // Server-observed connect time (route start to avatar READY), so
    // production connects are measured.
    connectMs: v.optional(v.number()),
```

- [ ] **Step 2: sessions.ts.** Replace `markCloseDelivered` with:

```ts
// Internal: written only by checkSignOff. First stamp wins; the check
// reports conversation state, so a later re-affirmation must not move the
// landing clock.
export const markSignOff = internalMutation({
  args: {
    id: v.id("sessions"),
    by: v.union(v.literal("user"), v.literal("panelist"), v.literal("both")),
    turnAt: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session || session.status !== "live" || session.signOff !== undefined) return
    await ctx.db.patch(args.id, { signOff: { by: args.by, at: Date.now(), turnAt: args.turnAt } })
  },
})

// "Keep going" on the ribbon. Owned and live only; the dismissal time
// keeps the check from re-stamping on the goodbye it just dismissed.
export const dismissSignOff = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const session = ownedOrNull(identity, await ctx.db.get(args.id))
    if (!session || session.status !== "live") return
    await ctx.db.patch(args.id, { signOff: undefined, signOffDismissedAt: Date.now() })
  },
})

// The sign-off check: one fast model call over the last eight turns (plus
// the panelist's in-progress line when the room sends one). Public because
// the room calls it with the caller's token on every turn; reads are
// ownership-scoped and the stamp is first-wins, so a direct caller can only
// end their own session early.
export const checkSignOff = action({
  args: { sessionId: v.id("sessions"), provisional: v.optional(v.string()) },
  handler: async (ctx, args): Promise<SignOffBy | null> => {
    await requireIdentity(ctx)
    const session = await ctx.runQuery(api.sessions.get, { id: args.sessionId })
    if (!session || session.status !== "live" || session.signOff !== undefined) return null
    const window = signOffWindow(
      session.transcript,
      session.signOffDismissedAt,
      args.provisional?.trim() || undefined
    )
    if (window.length === 0) return null

    const openai = await createOpenAI()
    const settings = modelSettings("fast")
    const response = await openai.chat.completions.create({
      ...settings,
      messages: [
        { role: "system", content: SIGN_OFF_PROMPT },
        { role: "user", content: window },
      ],
      response_format: { type: "json_object" },
    })
    await recordUsage(ctx, {
      userId: session.userId,
      kind: "close_check",
      practiceId: session.practiceId,
      sessionId: args.sessionId,
      model: settings.model,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    })

    let by: SignOffBy | null = null
    try {
      const parsed = JSON.parse(response.choices[0]?.message?.content ?? "")
      if (parsed.signOff === "user" || parsed.signOff === "panelist" || parsed.signOff === "both") {
        by = parsed.signOff
      }
    } catch {
      // Malformed output detects nothing; the next turn re-runs the check.
    }
    if (by === null) return null

    // A provisional line has no committed turn yet: the stamp time stands
    // in for it. Otherwise the newest committed turn is the goodbye.
    const turnAt = args.provisional
      ? Date.now()
      : Math.max(...session.transcript.map(spokenTime), 0)
    await ctx.runMutation(internal.sessions.markSignOff, { id: args.sessionId, by, turnAt })
    return by
  },
})
```

Imports to add in `convex/sessions.ts`: `action` from the generated server, `createOpenAI, modelSettings` from `../src/lib/openai`, `recordUsage` from `./usage`, `SIGN_OFF_PROMPT, signOffWindow, type SignOffBy` from `../src/lib/signOff`, `spokenTime` from `../src/lib/transcript`. Check each is not already imported.

`verifiedEndedReason`: replace the `"verdict"` branch and add `"goodbye"`:

```ts
  if (claimed === "verdict") {
    return session.signOff !== undefined && session.signOff.by !== "user" ? "verdict" : "user"
  }
  if (claimed === "goodbye") {
    return session.signOff !== undefined ? "goodbye" : "user"
  }
```

Update the comment block above it: "verdict" and "goodbye" need the sign-off the server itself stamped.

`markRoomStarted`: add `connectMs: v.optional(v.number())` to args and patch `{ roomStartedAt: Date.now(), ...(args.connectMs !== undefined ? { connectMs: args.connectMs } : {}) }`.

- [ ] **Step 3: orchestrator.ts.** Remove the `closeCheck` half: the `Promise.all` becomes a single `await openai.chat.completions.create(...)` for the note prompt, delete the close-check `recordUsage` and the `markCloseDelivered` call, delete the `closingRead` derivation and the `variantOf`, `CLOSE_CHECK_PROMPT`, `closeCheckWindow` imports. Keep `bySpokenTime` (used for `recent`).

- [ ] **Step 4: Route** (`src/app/api/avatar/connect/route.ts`): `const routeStartedAt = Date.now()` as the first line of the handler; poll sleep `250`; `markRoomStarted({ id, connectMs: Date.now() - routeStartedAt })`.

- [ ] **Step 5:** `npx tsc --noEmit -p .` fails only on RoomShell (Task 5) references to `shouldLandAfterClose` / `closeDeliveredAt`. Continue.

---

### Task 4: Bridges: the triggers

- [ ] **Step 1: UserSpeechBridge.** Add `const checkSignOff = useAction(api.sessions.checkSignOff)`; after `decide(...)` in `writeFinalTurn`, add:

```ts
          checkSignOff({ sessionId }).catch((err) =>
            console.error("sessions.checkSignOff failed:", err)
          )
```

Add `checkSignOff` to the effect's dependency array.

- [ ] **Step 2: TranscriptBridge.** Replace the component body with:

```tsx
// A turn's interims arrive at speech onset and stop when the avatar does;
// the final only lands when her next turn starts. Silence this long after
// the last interim means the line is finished being spoken.
const TURN_SETTLE_MS = 2_500

export const TranscriptBridge = ({ sessionId, character }: TranscriptBridgeProps) => {
  const addTranscriptEntry = useMutation(api.sessions.addTranscriptEntry)
  const decide = useAction(api.orchestrator.decide)
  const checkSignOff = useAction(api.sessions.checkSignOff)
  const session = useAvatarSession()

  // In-progress turns by id: first-seen wall clock (the final's spokenAt),
  // the accumulated text, and the settle timer that sends the text to the
  // sign-off check while the final is still a turn away.
  const turns = useRef(
    new Map<string, { firstSeenAt: number; text: string; settle: ReturnType<typeof setTimeout> | null; checked: boolean }>()
  )

  useTranscription(
    (entry) => {
      if (!isAvatarSpeech(entry)) return
      const turn = turns.current.get(entry.id) ?? {
        firstSeenAt: Date.now(),
        text: "",
        settle: null,
        checked: false,
      }
      turns.current.set(entry.id, turn)
      if (!entry.final) {
        turn.text = entry.text
        if (turn.settle) clearTimeout(turn.settle)
        turn.settle = setTimeout(() => {
          turn.settle = null
          if (turn.checked || turn.text.trim().length === 0) return
          turn.checked = true
          checkSignOff({ sessionId, provisional: turn.text }).catch((err) =>
            console.error("sessions.checkSignOff failed:", err)
          )
        }, TURN_SETTLE_MS)
        return
      }
      if (turn.settle) clearTimeout(turn.settle)
      turns.current.delete(entry.id)
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
  }, [session.state])

  return null
}
```

Update the header comment: interims now also feed the sign-off check.

---

### Task 5: RoomShell: landing, ribbon, time-up, connect, clock anchors

- [ ] **Step 1: Imports.** Replace `shouldLandAfterClose` with `shouldLandOnTime, COLD_CALL_CUE` in the roomClock import. Add `import { RIBBON_MS, USER_SPEECH_GAP_MS, landAfterRibbon, signOffPhase } from "@/lib/signOff"`. Add `const dismissSignOff = useMutation(api.sessions.dismissSignOff)` beside `endSession`.

- [ ] **Step 2: Speech times.** Next to `lastHeardAtRef`, add `const avatarSpokeAtRef = useRef<number | null>(null)`. Replace `onSpeakingChange={setIsAvatarSpeaking}` with a handler:

```ts
  const handleAvatarSpeaking = useCallback((speaking: boolean) => {
    if (speaking) avatarSpokeAtRef.current = Date.now()
    setIsAvatarSpeaking(speaking)
  }, [])
```

Note: the speaking signal flips on with every interim, so `avatarSpokeAtRef` must record the start only: set it when `speaking` is true and the previous value of `isAvatarSpeaking` was false. Use a ref mirror:

```ts
  const avatarSpeakingRef = useRef(false)
  const handleAvatarSpeaking = useCallback((speaking: boolean) => {
    if (speaking && !avatarSpeakingRef.current) avatarSpokeAtRef.current = Date.now()
    avatarSpeakingRef.current = speaking
    setIsAvatarSpeaking(speaking)
  }, [])
```

- [ ] **Step 3: Ribbon state and reasons.** Add `const [ribbonAt, setRibbonAt] = useState<number | null>(null)`. Extend `handleLand`'s reason type to `"time" | "idle" | "verdict" | "goodbye"`.

- [ ] **Step 4: The tick.** Replace the time rule and the close rule with:

```ts
      if (roomStartedAt !== undefined && !failedEmptyRoom) {
        const userSpeaking =
          lastHeardAtRef.current !== null && at - lastHeardAtRef.current < USER_SPEECH_GAP_MS
        if (
          shouldLandOnTime({
            elapsed: at - roomStartedAt,
            roomMs,
            closingRead,
            avatarSpeaking: isAvatarSpeaking,
            userSpeaking,
          })
        ) {
          handleLand("time")
        }
      }
      // The sign-off protocol: someone signed off, the other replied, the
      // ribbon plays, the line drops.
      if (!failedEmptyRoom) {
        const phase = signOffPhase({
          signOff: session.signOff,
          closingRead,
          now: at,
          avatarSpeaking: isAvatarSpeaking,
          avatarSpokeAt: avatarSpokeAtRef.current,
          userHeardAt: lastHeardAtRef.current,
        })
        if (phase === "drop") {
          setRibbonAt((current) => current ?? at)
        }
      }
```

Add `session.signOff`, `closingRead`, `roomMs` to the dependency array. Then a separate small effect for the ribbon landing, keyed on `ribbonAt` and `now`:

```ts
  // The ribbon's beat, then the drop. Its own effect so "Keep going" can
  // cancel it by clearing ribbonAt.
  useEffect(() => {
    if (ribbonAt === null || !session.signOff) return
    if (!landAfterRibbon(ribbonAt, now)) return
    handleLand(session.signOff.by === "user" ? "goodbye" : "verdict")
  }, [ribbonAt, now, session.signOff, handleLand])
```

- [ ] **Step 5: Keep going.**

```ts
  const handleKeepGoing = () => {
    setRibbonAt(null)
    dismissSignOff({ id: session._id }).catch((err) => console.error("dismiss sign-off failed:", err))
  }
```

If the server clears `signOff` the ribbon can't re-arm from the same stamp: `setRibbonAt` only sets when `phase === "drop"`, which needs a stamp.

- [ ] **Step 6: The ribbon UI.** Inside `<main>`, after the invitation block:

```tsx
        {ribbonAt !== null && !landing && (
          <div className="absolute bottom-[110px] left-1/2 z-[5] flex -translate-x-1/2 items-center gap-3 rounded-full border border-line-2 bg-black/70 px-4 py-2 max-lg:bottom-[124px]">
            <span className="font-mono text-[11px] uppercase tracking-[.12em] text-white/85">
              Ending the call
            </span>
            <button
              type="button"
              onClick={handleKeepGoing}
              className="focus-ring rounded font-mono text-[11px] uppercase tracking-[.12em] text-accent-blue underline"
            >
              Keep going
            </button>
          </div>
        )}
```

- [ ] **Step 7: Cold cue.** Replace the invitation derivation:

```ts
  const invitation =
    roomStartedAt && !isAvatarSpeaking
      ? closingRead
        ? shouldInvite(roomStartedAt, now, roomMs)
          ? pickInvitation(session._creationTime, firstNameOf(session.persona.name))
          : null
        : phase === "closing" || phase === "resolving"
          ? COLD_CALL_CUE
          : null
      : null
```

(`phase` is computed just above it; move the `invitation` line below `phase` if needed.)

- [ ] **Step 8: Connect abort retry.** Add `const mountedRef = useRef(false)` with `useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])`. Replace the first line of `handleAvatarError`:

```ts
      // An abort while the room is still mounted is React re-running the
      // mount (dev strict mode, a remount mid-connect): the SDK caches the
      // abort as a permanent error for this key, so the only way forward is
      // a fresh attempt. After unmount it is the room cancelling itself.
      if (err.name === "AbortError") {
        if (mountedRef.current) handleRetryConnect()
        return
      }
```

Add `handleRetryConnect` to its dependency array.

- [ ] **Step 9: Clock anchors.** `SessionClock` takes `startedAt: number` as a prop and drops its own state. The recording chip:

```tsx
            {sessionOver ? "Ended" : landing ? "Wrapping up" : roomStartedAt === undefined ? "Connecting" : "Recording"}
          </span>
          {!sessionOver && !landing && roomStartedAt !== undefined && <SessionClock startedAt={roomStartedAt} />}
```

Both `TranscriptPanel` and both `LiveNotes` get `startedAt={roomStartedAt ?? session._creationTime}`.

- [ ] **Step 10:** `npx tsc --noEmit -p . && pnpm lint && pnpm test`. Then `npx convex dev --once`.

---

### Task 6: Copy and the budget line

- [ ] **Step 1:** `PracticeVariant.copy.actionItemsFooter?: string` in `types.ts` (comment: `// The to-do list's footer; default names the persona as the one who follows up.`). Cold variant: `actionItemsFooter: "Bring these into your next call."`. Debrief page:

```ts
  const variant = variantOf(pack, practice.scope)
```

and the footer line: `{variant.copy.actionItemsFooter ?? `${firstNameOf(session.persona.name)} follows up on these next session.`}`.

- [ ] **Step 2:** In `src/domains/sales/variant.ts` export `COLD_CALL_MINUTES = 2` and use it for `roomMinutes`. In the cold briefing preamble add a third segment:

```ts
        ` This call runs about ${minutesPhrase(COLD_CALL_MINUTES)}. When it has run its course, end it the way you would: say you have to get back to it, say goodbye, and stop.`,
```

Test in `briefing.test.ts`: `assert.match(briefing.personalityPreamble, /about two minutes/)`.

---

### Task 7: Evaluation script

- [ ] **Step 1:** `scripts/fixtures/signoff.json`: an array of `{ "lane": "...", "label": "user" | "panelist" | "both" | "none", "turns": [{ "type": "user" | "panelist", "text": "..." }] }`, at least 80 items, balanced, with look-alikes (quoted goodbyes, greetings, "final question" announcements, mid-conversation thanks) and real sign-offs in every lane's voice.

- [ ] **Step 2:** `scripts/eval-signoff.ts`:

```ts
import { readFileSync } from "node:fs"
import { SIGN_OFF_PROMPT, signOffWindow } from "../src/lib/signOff.ts"
import { createOpenAI, modelSettings } from "../src/lib/openai.ts"

type Fixture = { lane: string; label: string; turns: { type: "user" | "panelist"; text: string }[] }

const fixtures: Fixture[] = JSON.parse(readFileSync(new URL("./fixtures/signoff.json", import.meta.url), "utf8"))
const openai = await createOpenAI()
const settings = modelSettings("fast")

const counts: Record<string, { tp: number; fp: number; fn: number }> = {}
const bump = (label: string, key: "tp" | "fp" | "fn") => {
  counts[label] ??= { tp: 0, fp: 0, fn: 0 }
  counts[label][key] += 1
}

for (const fixture of fixtures) {
  const turns = fixture.turns.map((turn, i) => ({ ...turn, timestamp: i * 1_000 }))
  const response = await openai.chat.completions.create({
    ...settings,
    messages: [
      { role: "system", content: SIGN_OFF_PROMPT },
      { role: "user", content: signOffWindow(turns, undefined, undefined) },
    ],
    response_format: { type: "json_object" },
  })
  const answer = JSON.parse(response.choices[0]?.message?.content ?? "{}").signOff ?? "none"
  if (answer === fixture.label) bump(fixture.label, "tp")
  else {
    bump(fixture.label, "fn")
    bump(answer, "fp")
    console.log(`MISS [${fixture.lane}] expected ${fixture.label}, got ${answer}\n${fixture.turns.map((t) => `  ${t.type}: ${t.text}`).join("\n")}\n`)
  }
}

for (const [label, c] of Object.entries(counts)) {
  const precision = c.tp + c.fp === 0 ? 1 : c.tp / (c.tp + c.fp)
  const recall = c.tp + c.fn === 0 ? 1 : c.tp / (c.tp + c.fn)
  console.log(`${label.padEnd(9)} precision ${(precision * 100).toFixed(1)}%  recall ${(recall * 100).toFixed(1)}%  (n=${c.tp + c.fn})`)
}
```

Run: `node --env-file=.env.local scripts/eval-signoff.ts`. Add `"eval:signoff": "node --env-file=.env.local scripts/eval-signoff.ts"` to package.json scripts. Bar: any `none` fixture classified as a sign-off counts against the 1 percent false-ending bar; sign-off recall at 95 percent or better. Fix the prompt and re-run until it passes.

---

### Task 8: Verification

- `pnpm test && npx tsc --noEmit -p . && pnpm lint && npx convex dev --once`
- `pnpm eval:signoff` once; record the numbers in the hand-off.
- Dev walkthrough (developer): cold call, say goodbye first; cold call, let Greg hang up; founder lane, say "that's everything" and confirm the closing read still lands it; keep talking past two minutes on a cold call and confirm the hold and cap; click Keep going once.

## Self-review

- Spec coverage: schema (3.1), check and stamps (3.2), triggers (4), landing and ribbon (5.3 to 5.6), policy per variant (Task 1 rules), time-up and cue (2, 5.4, 5.7), connect (3.4, 5.8, 5.9), copy and budget (6), evaluation (7).
- Placeholders: none.
- Type consistency: `SignOff { by, at, turnAt }` everywhere; `signOffPhase` input names match Task 5; `shouldLandOnTime` input names match Task 2; `handleLand` reasons include `"goodbye"` and the validator has it.
