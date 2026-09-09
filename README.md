# Prestage

The interview before the interview. You bring a pitch, a sale, an audit, or a job interview, and a live, photoreal counterpart reads your materials, finds what a real one would find, and pushes on it out loud. You leave with a debrief of what held, what did not, and what to fix before the real thing.

## The lanes

Four lanes, each a domain pack with its own intake, prep, personas, and debrief:

- **Pitch a startup**: a VC, a target customer, or a technical architect. You choose who to face.
- **Pitch a sale**: a pitch meeting with a buyer who has read your materials, or a two-minute cold call with a prospect who has not.
- **Face an audit**: an assessor who reads your evidence against the controls in scope.
- **Practice an interview**: an interviewer who builds a role-specific plan first and keeps the questions sealed until the room.

## How it works

1. **Brief**: type it or talk it. A spoken brief is transcribed and shaped into the lane's fields; only what you actually said fills in.
2. **Read**: materials are extracted with page, slide, and sheet markers so every later claim can cite its source.
3. **Pre-read** or **Blueprint**: the audit lanes separate what your materials support from what they only assert, and show the gap map. Add a document and the audit re-runs on the full set, marking the gaps it closed. The interview lane builds its plan and asks its clarifying questions.
4. **Panel**: meet or choose your counterpart, and run a quick mic and noise check.
5. **Room**: a live conversation with a Runway Character that hears you and pushes back in its own voice. It ends the way a real one does, when someone signs off, or when the time is up.
6. **Debrief**: what held, what did not, and your to-dos, with the counterpart's spoken verdict. No scores.

## The grounding rule

The product does not make things up, and that rule lives in the types, not in a prompt. A `Claim` carries a `citation`; there is no shape for a claim without one, so an ungrounded assertion cannot be constructed, only demoted to a gap. Intake fills only the fields it heard and flags the rest. A brief that says nothing defensible gets a gap map that says so, rather than an invented compliment.

## Stack

Next.js and Convex (database, server functions, realtime, crons), Clerk (auth), Runway Characters (`@runwayml/avatars-react`), AssemblyAI streaming transcription, OpenAI for the read, the audit, the room's orchestration, and the debrief.

## Setup

```bash
pnpm install
npx convex dev        # provisions the backend, watches functions
pnpm dev              # http://localhost:3000
```

In `.env.local` (read by the Next server and the client build):

- `RUNWAYML_API_SECRET`, `ASSEMBLYAI_API_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`

In the Convex deployment, set with `npx convex env set NAME value` (read by Convex actions, which never see `.env.local`):

- `RUNWAYML_API_SECRET`, `OPENAI_API_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`: the Clerk instance's issuer URL (`https://….clerk.accounts.dev`). Convex validates the session JWT against it; also create a JWT template named `convex` in the Clerk dashboard.
- `OPENAI_MODEL_FAST`, `OPENAI_MODEL_QUALITY` (optional): model overrides, defaulting to `gpt-4o-mini`.

`npx convex dev` writes `NEXT_PUBLIC_CONVEX_URL` for you.

Avatars are registered per persona, on each deployment, from the CLI (add `--prod` for production):

```bash
npx convex run avatars:register '{"packId":"founder","personaId":"vc-01","runwayAvatarId":"…"}'
```

The connect route only mints sessions for registered avatars.

Auth is Clerk, invite-only: sign-up is Restricted in the Clerk dashboard, and testers are added under Users → Invitations. Sign-in is Google or an email code at `/sign-in`. Every page, API route, and public Convex function requires a session, and each user sees only their own practices, sessions, and debriefs.

## Checks

```bash
pnpm test             # unit tests
pnpm lint
npx tsc --noEmit -p .
pnpm eval:signoff     # the sign-off detector against recorded windows; needs OPENAI_API_KEY in .env.local
```

## Deploy

Vercel builds run `npx convex deploy --cmd 'pnpm build'` (see `vercel.json`), so the Convex functions and the app ship together. Engineering standards live in [docs/engineering-standards.md](docs/engineering-standards.md).
