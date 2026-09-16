# Counterpart casts

Date: 2026-09-16. Status: reviewed; amended after the counterpart-stage critique.

## Why

Every role a user can be locked into today has exactly one face. A user who only runs pitch meetings only ever meets Cole. A user who only picks the VC only ever meets Victoria. Users are siloed by lane and by role, so the cast has to be judged per role, not per app. A tester's joke about the sales counterpart being white was two signals at once: does the product imagine people like me on the other side of the table, and will I face the range of people I will actually face. Both point the same way.

The cast content already exists: twenty-seven Runway Characters, three faces per role, photos in `public/avatars/`, ids and voices in `docs/cast/README.md`. This spec covers the code that puts them in front of users.

## Principles

1. **The role is the personality; the face is casting.** Every face in a role carries the same personality, attack line, tags, and signature. Only name, photo, voice, and Runway Character differ. Denise is exactly as immovable as Cole.
2. **The product assigns the face.** There is no catalog of faces to choose from and no demographic labels anywhere in the product. Heritage lives in the casting notes only.
3. **A practice never changes face.** The counterpart drawn for a practice stays for every session in it, in every lane. A practice is one target (one deck, one dental office, one audit scope, one role) and its to-dos were written by one person. This holds for the cold call too: a second cold-call session is a second attempt at the same call, to the same person, who still does not remember you.
4. **Strangers rotate between practices.** Every new practice draws a fresh face for its role, excluding the face the user met most recently in that role. Variety comes from new practices, never from inside one.
5. **Returning users can ask for someone they have met.** The only choice offered is "face them again," and it only ever references a face from the user's own history in that role.

## Vocabulary

- **Archetype**: a role in a lane. The VC, the target customer, the technical architect, the meeting buyer, the cold-call prospect, the assessor, the recruiter, the hiring manager, the senior practitioner. Nine today. Carries everything about behavior and the UI copy that describes it.
- **Persona**: one face for an archetype. Carries only what differs between faces: id, archetype id, name, image. Twenty-seven today.
- **Counterpart**: a persona resolved against its archetype, which is what every consumer reads. `resolveCounterpart(pack, personaId)` returns `Persona & Archetype`.
- **Cast**: the personas of one archetype.

## Data model

### Domain packs

`Persona` shrinks to `{ id, archetypeId, name, image }`. A new `Archetype` type takes `{ id, role, shortRole, tone, attack, bio, tags, signature }`. `DomainPack` gains `archetypes: Archetype[]` beside `personas: Persona[]`. A `Counterpart` type is `Persona & Omit<Archetype, "id">`, and the registry exports `resolveCounterpart`, `castOf(pack, archetypeId)`, and `laneFaces(pack, n)`.

Existing persona ids stay as they are (`buyer-01`, `prospect-01`, `vc-01`, `tc-01`, `ta-01`, `assessor-01`, `screener-01`, `hm-01`, `practitioner-01`) so existing practices, sessions, and avatar registrations keep resolving. New faces take the next numbers in the same series.

`PracticeVariant.personaId` becomes `archetypeId: string | null`. `lockedPersona` becomes `lockedArchetype`. The interview pack's format-to-interviewer map and the founder pack's recommendation return archetype ids. The registry's `variantOf` default returns `archetypeId: null` as it returns `personaId: null` today.

### Every consumer of the persona list moves together

Six places besides the counterpart stage look a persona up by id and then read a field that moves to the archetype. All six switch to `resolveCounterpart` in the same change:

- `src/domains/registry.ts`: the lock (`lockedPersona` → `lockedArchetype`).
- `src/app/(app)/page.tsx`: the pick-up card and the practice cards (name, short role).
- `src/app/(app)/p/[practiceId]/page.tsx`: the hub (name, short role).
- `src/app/api/export/route.ts`: the PDF export (name).
- `src/components/simulation/intake/BriefPreview.tsx`: the initials placeholder.
- `convex/sessions.ts`: the session insert (role, tone).

### Practices

`practices.cast: Record<archetypeId, personaId>`, optional for existing rows. It holds the face drawn for each archetype in the pack, drawn server-side when the practice is created. For a single-archetype lane it has one entry; for the founder and interview lanes, three, so the counterpart cards show the actual faces the user would meet.

`practices.personaId` keeps its meaning: the face this practice is with. For a locked variant it is set at creation from the cast. For the founder and interview lanes it is set when the user picks a role, from the cast entry for that role. It is never set from a client-supplied persona id.

Existing practices without `cast` get one lazily: the counterpart stage calls `practices.ensureCast` once, only when the practice has no cast. The mutation is idempotent (a practice that already has a cast is a no-op, so a re-render never redraws), draws for any archetype missing an entry, and, if the practice already has a `personaId`, seeds that archetype's entry from it so nothing a user has already met changes.

### Sessions

`sessions.persona` is unchanged. It already snapshots id, archetype id, name, role, tone, and Runway avatar id, which is what makes history and transcripts survive cast changes. Role and tone come from the archetype at insert time.

## Assignment rules

### The draw

`drawPersona(cast, lastFacedPersonaId, rng)` is a pure function in `src/domains/cast.ts`: uniform over the cast, excluding the face the user met most recently in that archetype, falling back to the whole cast when it has one face or none was met. `rng` is injected so tests are deterministic; Convex mutations pass `Math.random`, which Convex seeds deterministically per mutation.

The most recently faced persona for an archetype is read from the user's own practices: the newest practice in this pack, by `lastSessionAt`, whose `personaId` resolves to that archetype. That is one indexed query on `practices.by_user` (the user-id prefix, so archived practices count too) and no new index.

### When faces are drawn

- **Practice creation** (`practices.create`): draw `cast` for every archetype in the pack. If the variant locks an archetype, set `personaId` from the cast.
- **Role choice in the founder and interview lanes** (`practices.setArchetype`, replacing `setPersona`): set `personaId` from `cast[archetypeId]`. Refused once the practice has any session: a different role is a new practice.
- **Nowhere else.** There is no redraw at session end for any variant. The only way a practice's face changes after creation is `faceAgain`, below, and only before the first session.

### The memory guard

`sessions.create` stops accepting a persona id. It takes `practiceId` and an optional `archetypeId` for a chooser lane's first session, and resolves the face on the server: `practice.personaId` if set, otherwise `cast[archetypeId]`, otherwise an error. The line that patches `practices.personaId` from the client's choice is removed. A practice therefore cannot change face after its first session by any client path. `practices.continueSession` already reads `practice.personaId` and needs no change.

### Face them again

`practices.faceAgain({ id, personaId })`: sets `cast[archetype]` and `personaId` to a face the user has already met in that archetype. The server checks the persona belongs to the pack and the archetype, that the practice has no sessions yet, and that at least one of the user's practices has this `personaId` with `sessionCount > 0`. It is the only way a client names a persona id, and it can only name one from the user's own history. A fresh cold-call practice can ask for Greg again this way; an existing one cannot, because its face is already set.

## Counterpart stage

The counterpart stage (`PanelSetup.tsx`) renders from `practice.cast` instead of `pack.personas`:

- **Locked variants** show the one drawn counterpart, as today.
- **The founder and interview lanes** show one card per archetype, each with the face drawn for it. The recommendation logic works on archetypes. Choosing a card calls `setArchetype`.
- **Face them again**: when the user has met a different face in the relevant archetype before, and the practice has no sessions yet, the card carries one line: "Face Cole again instead." It is a text link, never a second button, so a card carries one blue action. Choosing it calls `faceAgain`. New users never see the line. There is no re-roll and no picker.
- **Return visits** lead with continuity, not recommendation. The stamp on the practice's counterpart reads "Continue with Jun · 2 open items" instead of "Recommended"; "Recommended · targets go-to-market" is reserved for a practice's first visit. The chooser's closing line "You can face the others in later sessions" becomes "in another practice."

Three findings from the 2026-09-15 critique land in the same rewrite, since they touch the same file:

- **Reading order**: face, choose, check, enter. The mic check moves below the persona cards and above the consent line, in both shapes.
- **The room line**: one mono label under the heading, from the variant so it cannot drift: "5 min · ends on their verdict or the clock · debrief after"; for the cold call, "2 min · {first name} decides in the first thirty seconds."
- **One signal**: the Signal Blue pill is the selection marker and moves with the selected card. The recommendation or continuity note is a colorless stamp (badge-lane style) pinned to its own card.

Names in lane copy become dynamic. Today: "What Cole will read," "Who Cole is playing," "in Cole's terms," "Greg doesn't know you're calling," "What Priya will read," the cold-call start script "Yeah, this is Greg," and the next-step label "Prep the meeting with Cole." Each takes the counterpart's first name at render time, or drops the name where the counterpart is not yet drawn. The next-step label becomes "Prep the meeting."

## Home page

- **First-run lane cards** show three faces per lane, every role represented: `laneFaces(pack, 3)` takes one face from each archetype's cast first, then keeps filling round-robin across archetypes until it has three. Interview and founder get one per role; audit gets three assessors; sales gets the buyer, the cold call, then a second buyer. Faces come in cast order, so the page is stable and reads no data. The count is the helper's argument, so it is one number to change.
- **Discs carry the portrait** on the first-run cards, the practice cards, and the pick-up card, with the existing initials disc as the fallback for a missing photo.
- Everything else on home (the rail, lane chips, counts, search, archive) reads no counterpart and does not change.

## Content and assets

- **Personalities**: nine files in `docs/cast/personalities/`, one per archetype, with a name placeholder. The 27 per-face duplicates are deleted. `scripts/push-personalities.ts` reads the nine files and the id table in the cast README, substitutes each face's name, and updates each Character through `PATCH /v1/avatars/{id}` (`personality`). A `--dry-run` flag fetches each Character and prints the diff without writing. This also fixes the three founder Characters whose stored text still describes a live panel.
- **Portraits** are downscaled to 1920px wide before they are committed. The only render site is the counterpart stage's 5:3 tile at up to 320px on desktop or the viewport width on a phone, so 1920 clears every device pixel size with margin. Runway holds the originals.

## Registration

`avatars.register` is unchanged. Once the packs carry the new personas, the eighteen commands run from the id table in `docs/cast/README.md`, for the dev deployment and again with `--prod`. Dev and prod share the same Runway Characters, so the ids are the same on both.

## Testing

Pure functions get unit tests beside their modules: `drawPersona` (excludes the last face, uniform over the rest, single-face cast, no history), `resolveCounterpart` and `castOf` (every persona resolves, every archetype has at least one face, every lane's registration ids are unique), `laneFaces` (every archetype represented before any repeats, stable order, honors the count), and the copy helpers that take a first name. Pack tests assert that each pack's personas and archetypes are consistent and that every locked variant names an archetype the pack has.

Convex mutations are kept thin over those functions. The guards are exercised by hand against the dev deployment before review: a practice keeps its face across two sessions in every lane, including a cold call; a new cold-call practice draws a different stranger than the last one faced; `faceAgain` refuses a face not in history and refuses after the first session; `setArchetype` refuses after the first session; a client-supplied persona id no longer reaches `sessions.create`.

## Out of scope

- Changing a face inside a practice, for any lane. Variety is a new practice.
- Weighting the draw by demographics. Draws are uniform; the point of the cast is exposure.
- Choosing a cold-call stranger from the prospect field in the sales intake. A later decision.
- Language localization.
- A fourth face per role. The data model allows any cast size; content is the only cost.

## Sequence

1. Types and registry: `Archetype`, slim `Persona`, `Counterpart`, `resolveCounterpart`, `castOf`, `laneFaces`, `drawPersona`, variant `archetypeId`, `lockedArchetype`. Tests.
2. Packs: split each lane's personas into archetypes plus casts with the eighteen new faces. Dynamic first names in lane copy. Tests.
3. Schema and mutations: `cast` on practices, the draw at creation, `setArchetype`, `faceAgain`, `ensureCast`, `sessions.create` without a client persona id, the six consumers moved to the resolver.
4. Counterpart stage and home: render from the cast, archetype cards, the face-again link, the continuity stamp, the reading order, the room line, the selection pill, the three-face lane cards, portrait discs.
5. Content: nine personality files, the push script, downscaled portraits.
6. Register the eighteen Characters on dev, run the hand checks, dry-run then push the three founder personalities, then register on prod.
