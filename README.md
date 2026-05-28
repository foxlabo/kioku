# Kioku

Local Markdown notes with an AI panel that **answers questions using your own
notes**. Type a note, hit save, then ask the assistant — it retrieves the
relevant notes and writes a grounded answer.

## Status

🚧 **Pre-MVP** — under active development.

## Features (planned for MVP)

- 📝 **Markdown notes** — title, body, folder; live preview
- 🔎 **Keyword search** — fast, local
- 🤖 **Ask your notes** — chat panel that retrieves your notes and answers
  with citations (OpenAI)
- 💾 **Local-first** — SQLite-backed, no server required
- 🌐 **Japanese-first UX** — UI strings and prompts tuned for Japanese

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19.2
- **Styling**: Tailwind CSS 4 + `@tailwindcss/typography`
- **AI**: Vercel AI SDK v6 (OpenAI)
- **DB**: SQLite (`better-sqlite3`) + Drizzle ORM
- **Quality**: Biome + Vitest + Playwright, TypeScript strict

## Quick Start

```bash
pnpm install
cp .env.example .env.local   # add OPENAI_API_KEY to enable Ask
pnpm dev
```

Open <http://localhost:3000>.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Development](./docs/DEVELOPMENT.md)
- [Roadmap](./docs/ROADMAP.md)

## License

[MIT](./LICENSE)
