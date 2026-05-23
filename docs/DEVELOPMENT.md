# Development

## Prerequisites

- Node 20+
- pnpm 10+

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Two sample notes are auto-seeded on first run so the home page is not empty.

## Environment variables

| Key | Required for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Ask Q&A | from <https://platform.openai.com> |
| `DATABASE_URL` | DB | default `file:./kioku.db` |

Notes browsing / editing works with no API key. Only the Ask panel needs it.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | production build |
| `pnpm check` | Biome lint + format check |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm db:generate` | Drizzle: generate migration |
| `pnpm db:push` | Drizzle: push schema to local DB |

## Workflow

- Branch: `feature/{topic}` / `fix/{topic}`
- Conventional Commits
- Tests required for pure logic (search, ranking); Playwright for user flows
- Lint/format enforced
