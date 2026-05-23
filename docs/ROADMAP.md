# Roadmap

## v0.1 — MVP

- [ ] Project scaffold (Next.js 16, Biome, Drizzle, Vitest, Playwright)
- [ ] SQLite schema: notes + auto-migrate + sample seed
- [ ] Notes list with create / delete + keyword search
- [ ] Markdown editor with live preview
- [ ] Server actions for note CRUD
- [ ] `POST /api/notes/ask` streaming endpoint with retrieval + citations
- [ ] Ask panel: chat widget grounded on retrieved notes
- [ ] Unit tests for pure search/retrieval logic

## v1.1 — Polish

- [ ] Semantic search via embeddings (OpenAI / local)
- [ ] Backlinks (`[[note title]]`) + a graph view
- [ ] Folder tree UI (drag/drop)
- [ ] Export note(s) as Markdown
- [ ] Keyboard shortcuts (new note, focus search, focus ask)
- [ ] Per-note model + temperature for Ask
- [ ] Playwright E2E for write-note → ask → cite

## v2 — Beyond

- [ ] Multi-user + auth
- [ ] Sync (CRDT / remote DB)
- [ ] Mobile / desktop packaging
- [ ] Local LLM via WebGPU / Ollama
