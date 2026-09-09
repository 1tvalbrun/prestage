# Sign-off protocol, cold-call time-up, and connect fixes

## Problems (observed on dev, 2026-09-07, two cold-call sessions)

1. **Connect took 71 to 74 seconds.** Runway reached READY in under two
   seconds each time; the wait was the room's own 70-second watchdog. In
   development React double-mounts the room, the abort-on-unmount cleanup
   cancels the first connect request, the SDK caches the abort as a permanent
   error for that key, and the room ignores abort errors. The silent retry
   at 70 seconds does all the work. Production connects in about five
   seconds, but the same path exists there for any remount mid-connect.
2. **The prospect said goodbye and the room stayed open.** No ending is
   detected for a cold call, and the panelist's last line only commits to
   the transcript when their next turn starts. The engine then filled the
   silence with a presence check and the clock landed the room a minute
   later.
3. **The clock cut the seller mid-sentence.** The time landing waits for the
   avatar to finish speaking, never for the user, and a cold call has no
   closing read to make the ending feel earned.
4. Cosmetics: the recording timer and transcript timestamps count from
   session creation, so the clock runs through the connect wait; the
   debrief footer says the prospect "follows up next session," which a
   cold-call prospect never does.

## Decisions

- One sign-off protocol for every lane, modeled on a phone call: someone
  signs off, the other replies, the line drops. Detection is a language
  model check over the last eight turns, run on every turn with its own
  trigger, and the panelist's in-progress line is checked the moment they
  stop speaking. The existing closing-read detector folds into it.
- The landing policy is per variant. Verdict lanes land only on the
  panelist's sign-off, so a user's "that's everything" still hands off to
  the closing read. Cold calls land on either party's sign-off.
- A 3.5-second "Ending the call · Keep going" ribbon before the drop, shown
  the moment the panelist's goodbye is stamped.
  Keep going clears the sign-off and the check ignores everything spoken
  before the dismissal.
- Cold-call time-up waits for the seller's sentence and the reply, capped
  twenty seconds past the budget. The prospect's briefing names the budget
  so most calls end on his goodbye, not the clock.
- Connect: an abort while mounted retries at once; READY polls every 250
  ms; the server-observed connect time is stored on the session.

## Design

### Data (`convex/schema.ts`)

```ts
sessions.signOff: v.optional(v.object({
  by: v.union(v.literal("user"), v.literal("panelist"), v.literal("both")),
  at: v.number(),       // stamp time
  turnAt: v.number(),   // spoken time of the last turn the check saw
}))
sessions.signOffDismissedAt: v.optional(v.number())
sessions.connectMs: v.optional(v.number())
sessions.closeDeliveredAt  // retired: kept optional for existing documents, never written or read
endedReason: adds "goodbye" (user-initiated or both) alongside "verdict" (panelist-initiated)
```

### Check (`src/lib/signOff.ts`, `convex/sessions.ts`)

- `SIGN_OFF_PROMPT`: lane-blind. The lines are numbered and the model
  answers `{"signOffLines": [numbers]}`: which lines are sign-offs. A
  sign-off is a wrap-up, final read, goodbye, or "I have to go" addressed to
  the other party as the end of this conversation. A goodbye quoted or
  narrated, a greeting, or an announced final question is not. The model is
  never asked who spoke: evaluation showed the fast model misattributes
  roles, and a user goodbye read as the panelist's would skip a verdict
  lane's closing read.
- `signOffLines(turns, after, provisional?)`: last eight turns by spoken
  time after `signOffDismissedAt`, plus the provisional panelist line last
  when given. `renderWindow` numbers and labels them.
- `resolveSignOff(lines, flagged)`: who signed off, from our own labels
  and the structure of the last two lines. A flagged line that ends with a
  question never counts (a last-chance "anything else?" or an echoed
  "Goodbye?" keeps the conversation going). A goodbye followed by the other
  party's flagged line, or by a reply of four words or fewer, is both. A
  goodbye the other party talked past is not an ending.
- Stamps are provisional (`reconcileSignOff`): the check runs on every turn;
  the other party's goodbye upgrades a one-sided stamp to both, anything
  else spoken after it clears the stamp, a re-affirmation keeps the original
  stamp, and both is final.
- Evaluation (92 windows, gpt-5-nano, 2026-09-08): false endings 0 of 39;
  sign-offs caught 52 of 53. Remaining "both" misses resolve as one party in
  the offline run; live, the earlier stamp plus the reply's check reconcile
  to both.
- `sessions.checkSignOff({ sessionId, provisional? })` public action:
  identity, owned live session, returns early when already signed off.
  One fast-tier model call, usage kind `close_check`. On a non-none answer
  calls `internal.sessions.markSignOff({ id, by, turnAt })`, first stamp
  wins. `turnAt` is the spoken time of the newest turn in the window, or the
  stamp time when the answer came from the provisional line.
- `sessions.dismissSignOff({ id })` public mutation: owned live session;
  clears `signOff`, stamps `signOffDismissedAt`.
- Spend guards on the check: the provisional line is clamped to transcript
  size (4,000 chars) and `claimSignOffCheck` allows one check per second
  per session (`lastSignOffCheckAt`), which never refuses a real turn and
  bounds what a looping caller can bill.
- `orchestrator.decide` no longer runs a close check.
- `end`: `"verdict"` verified by `signOff.by` in panelist or both;
  `"goodbye"` verified by any `signOff`.
- Cold-call debrief: an email the prospect asked for and the seller agreed
  to send is "follow-up"; an email the seller offered while being shown the
  door is "brushed-off". (The prompt contradicted itself before; observed as
  a brush-off verdict on an accepted email request, 2026-09-08.)

### Triggers (room bridges)

- `UserSpeechBridge`: after a written user final, call `decide` (notes) and
  `checkSignOff`.
- `SessionStatusBridge`: the avatar speaking signal is LiveKit's
  audio-level `isSpeakingChanged` on the avatar participant (via the SDK's
  `useAvatar`). Transcript chunks arrive in bursts with mid-sentence gaps
  and read as silence; a closing read was cut off at one on 2026-09-08.
- `TranscriptBridge`: keep the accumulated text of the in-progress avatar
  turn from its interims. When the speaking signal falls, wait 400 ms for
  the last chunk and send `checkSignOff({ provisional: text })` once for
  that turn; a 5-second chunk gap is the fallback trigger. On the final,
  write it and run `checkSignOff` only if no provisional check was sent for
  that turn id.

### Landing (`src/lib/signOff.ts` pure rules, `RoomShell`)

```ts
REPLY_WAIT_MAX_MS = 8_000     // cap on waiting for the other party
RECONCILE_MAX_MS = 15_000     // cap on waiting for the check on a reply
USER_SPEECH_GAP_MS = 3_000    // heard within this = still speaking
RIBBON_MS = 3_500             // after the panelist's goodbye, the ribbon is the user's window
RIBBON_MAX_MS = 45_000        // holds while audio plays (a closing read), capped only against a stuck signal
TURN_SETTLE_MS = 1_200        // TranscriptBridge: silence after the last interim before the provisional check

signOffPhase({ signOff, closingRead, now, avatarSpeaking, avatarSpokeAt, userHeardAt })
  -> "none" | "waiting" | "drop"
```

- No sign-off: none. Verdict lane and `by === "user"`: none.
- `both`: drop.
- Once the other party has started replying (avatar speech after
  `turnAt`, or the user heard after it), the room waits for the check on
  that reply to upgrade or clear the stamp, capped at `RECONCILE_MAX_MS`
  (15 s) for a reply that never classifies.
- No reply: `user` drops `REPLY_WAIT_MAX_MS` after `at`; `panelist` drops
  as soon as the avatar is quiet, so the ribbon shows about two seconds
  after the last word and is itself the user's window (speaking during it
  retracts it).
- RoomShell: while the phase is `drop`, `ribbonAt` holds the first drop
  time and the ribbon shows; any other phase clears it, so a stamp the
  check clears retracts the ribbon. The ribbon lands after `RIBBON_MS` once
  nobody is mid-line, and at `RIBBON_MAX_MS` (10 s) regardless, with
  `handleLand("goodbye" | "verdict")` (verdict when `by !== "user"`). Keep
  going: `dismissSignOff`, clear `ribbonAt`.
- Avatar speech times: RoomShell records the start of the latest avatar
  speech from the speaking signal's transitions.

### Time-up (`src/lib/roomClock.ts`)

```ts
shouldLandOnTime(elapsed, roomMs, avatarSpeaking)   // verdict lanes, unchanged rule
TIME_FINISH_GRACE_MS = 8_000
LAST_WORD_MAX_MS = 12_000
coldTimeUp({ elapsed, roomMs, now, userSpeaking, avatarSpeaking, avatarSpokeAt, lastWordAt })
  -> "open" | "finish" | "handOff" | "lastWord" | "land"
```

- Verdict lanes: today's rule (resolving or over, and the avatar quiet or
  the floor reached).
- Otherwise the ending is a hand-off, not a cut, with a cue at each beat
  in the top chip: from 80 percent "Wrap it up. Ask for the next step."; at
  the budget, while the user is mid-thought, "Time's up. Finish your
  thought." for up to 8 seconds; then the room stamps `lastWordAt`, mutes
  the user's mic, shows "Your mic is off. {First} has the last word.", and
  lands once the persona's reply has been spoken, or 12 seconds later if
  none comes. The mic and idle banners yield to the time chip. The
  invitations stay off without a closing read. The two endings exclude each
  other: a ribbon already up finishes the call and the clock does not hand
  off underneath it; once the hand-off has happened, a goodbye spoken as
  the last word raises no ribbon (observed both at once, 2026-09-08).
- The cold briefing adds: the call runs about two minutes; when it has run
  its course, end it the way you would. It also sets the prospect's floor:
  at least three exchanges before deciding, a real question about the
  operation earns another, and a last chance before any goodbye. A clean,
  specific ask with a time offered is taken or countered with a time unless
  the caller argued or offered nothing, and one real objection about cost,
  switching, or the current system comes before any yes; a second push
  after "I have to go" ends the call.

### Connect

- `handleAvatarError`: an `AbortError` while the room is mounted calls
  `handleRetryConnect()`; after unmount it is ignored as today.
- Route: poll every 250 ms; pass `connectMs` (route start to READY) to
  `markRoomStarted`, which stores it.
- Recording chip reads "Connecting" with no clock until `roomStartedAt`;
  `SessionClock` anchors at `roomStartedAt`; transcript and notes anchor at
  `roomStartedAt ?? _creationTime`.

### Copy

- `PracticeVariant.remembers: boolean` (cold call: false). The debrief
  footer and the home resume hero derive their copy from it: "{First}
  follows up on these next session" / "{First} is waiting on N items" when
  the persona remembers, "Bring these into your next session" / "You have N
  items on your list from last time" when not. `practices.list` rows carry
  `remembers` resolved server-side, so the list ships a flag rather than
  every practice's intake.

### Evaluation

`scripts/eval-signoff.ts` with `scripts/fixtures/signoff.json`: windows
across the four lanes labeled `user | panelist | both | none`. Prints
precision and recall per label. Run with the local OpenAI key before
merging and after any prompt change. Bar: no `none` window classified as a
sign-off above 1 percent; sign-offs caught at 95 percent or better.

### Not changed

Idle rule, user-ended session, the settle and debrief chain, the ending
contract's wording, Runway personalities.
