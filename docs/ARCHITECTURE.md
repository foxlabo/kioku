# Architecture

Design decisions for Kioku, a local Markdown note app with an AI Q&A panel.

## High-Level Decisions

| Concern | Choice | Why |
|---|---|---|
| Runtime | Next.js 16 App Router | Server components + streaming route handlers |
| Storage | SQLite + Drizzle | Local-first, zero infra |
| AI | Vercel AI SDK v6 (OpenAI) | Streaming Q&A with citations |
| Search | SQL LIKE (token-aware) | Keyword search is good enough for MVP; semantic search lands in v1.1 |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight` | Same proven stack as the rest of the portfolio |

## Data Model

```text
notes
  id: text (nanoid)
  title: text
  body: text (Markdown)
  folder: text (default '')
  createdAt: integer (unix ms)
  updatedAt: integer
```

A note belongs to a single `folder` string (free-form, "/Work/Projects"-style
paths are allowed but not enforced). Tags, embeddings, and a richer folder
tree are v1.1+.

## Search

`src/lib/notes/search.ts` exposes a pure function:

```ts
searchNotes(notes, query, { limit }): Note[]
```

It splits the query into tokens, scores each note by how many distinct tokens
appear in the title (3×) or body (1×), drops zero-score notes, and returns the
top `limit` by score then `updatedAt`. The function is **pure** — it operates
on an in-memory array — so the same logic is unit-testable and reusable from
the home page (full list) and the Ask endpoint (top-K retrieval).

## Ask (Q&A) Flow

`POST /api/notes/ask` accepts the conversation history as UIMessages, just
like Akari's chat. The route handler:

1. Loads all notes from the DB.
2. Picks the user's last message as the retrieval query.
3. Runs `searchNotes(...)` to take the top `K` (default 6) matching notes.
4. Builds a system prompt that includes those notes as `## {title}` sections
   and instructs the model to ground its answer and cite by title.
5. Streams the reply via `streamText(...).toUIMessageStreamResponse()`.

The client (`AskPanel`) uses `useChat` for the streaming UI; each request the
server re-retrieves notes based on the latest question, so follow-up questions
get fresh context.

## Why "local-first"

No server hosting is planned. SQLite removes all DB infra. The OpenAI call is
the only network dependency; flows that don't use Ask work fully offline.

## Inspired By, Not Copied From

Kioku's name, code, and UX are independent from Reor. Reor's source may be
read for understanding general patterns; no code is copied.

## Out of Scope (MVP)

- Semantic search / embeddings (v1.1)
- Backlinks / wiki-style `[[refs]]` (v1.1)
- Multi-user / auth (v2)
- Mobile / desktop packaging
