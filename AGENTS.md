# Prestage — Agent Instructions

Prestage is a pnpm monorepo. App-specific context lives with each app; start
with [apps/app/CLAUDE.md](apps/app/CLAUDE.md) for the Prestage app.

## Repo layout
```
prestage/
  apps/app/      the Prestage Next.js app (@prestage/app), with its Convex backend in convex/
  packages/      shared code (empty for now)
  docs/          engineering standards, cast docs, plans and specs
  .claude/       Claude Code settings (not committed)
  .superpowers/  Superpowers working notes (not committed)
```
apps/ holds deployable apps; packages/ holds shared code that apps import.

## Future structure
When the mobile app starts, shared logic (apps/app/src/domains, apps/app/src/lib) moves to packages/shared and Convex to packages/backend.

## Rules
- Follow [docs/engineering-standards.md](docs/engineering-standards.md) for all code.
- pnpm only. Run app commands from the root (`pnpm dev:app`, `pnpm build:app`,
  `pnpm test:app`, `pnpm lint`) or with `pnpm --filter @prestage/app <script>`.

## Convex safety
- `npx convex dev` and `npx convex dev --once` PUSH the current branch's functions and schema to the shared dev deployment, replacing whatever another branch pushed (including its indexes). `npx convex deploy` pushes to production.
- Never run any of these without my explicit approval in the current conversation.
- To check Convex connectivity, use read-only commands only (e.g. `npx convex data` to list tables).
- Before switching the dev deployment to a different branch's code, tell me which branch is currently deployed and what will be replaced.

## Do Not
- Call the product Prestage Prep. The domain is prestageprep.ai; the name is
  Prestage
- Commit or push. Ever. The developer is the only one who commits, after reviewing
  the diff. No git add/commit/stash workarounds; leave work uncommitted in
  the tree and stop for review.
- Add Co-Authored-By or "Generated with" attribution lines to commit
  messages or PR descriptions.
