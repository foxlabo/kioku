# CLAUDE.md — Kioku

Context for AI coding agents working on this repo.

## Project intent

Kioku is a portfolio-grade clean-room reimagining of `Reor`: local Markdown
notes with an AI panel that answers questions grounded on your notes. Quality
over speed.

## Hard rules

- **No code copy from Reor.** Reading its docs for understanding is fine.
- **TypeScript strict.** No `any` without a `// reason:` comment.
- **No `console.log`** in committed code.
- **Pure logic** (search ranking, prompt building) gets Vitest tests.
- Conventional Commits, small and atomic.

## Stack reminders

- Next.js **16** App Router (docs in `node_modules/next/dist/docs/`)
- React 19.2, Tailwind **4** (configured via CSS)
- AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`)
- Drizzle ORM + `better-sqlite3`

## Architecture rules

- DB access goes through `src/lib/db/`; routes/actions import from there.
- Search / retrieval logic is **pure** in `src/lib/notes/search.ts` so it can
  be unit-tested without the DB.
- The Ask endpoint re-retrieves notes each turn — context follows the
  current question, not the start of the conversation.
- Server Components must not pass functions as props to Client Components.

## Before claiming done

Run `pnpm typecheck && pnpm check && pnpm test`. For UI, verify in a real
browser — `next build` does not render dynamic routes so runtime bugs slip past.
