# AGENTS.md

## Project Overview

x-digest is a CLI tool that scrapes an authenticated user's X (Twitter) timeline via Playwright headless browser, applies configurable rule-based filters, then generates a personalised daily digest via an opencode skill and your local LLM.

## Tech Stack

- **TypeScript** (ESM, Node16 module resolution)
- **Playwright** for headless browser automation and GraphQL response interception
- **opencode** skill + `/digest` command for LLM-powered digest generation
- **Zod** for config schema validation
- **YAML** for user configuration
- **Vitest** for unit testing
- **pnpm** as package manager

## Architecture

The project has a two-phase pipeline:

1. **Scrape & Filter** (`src/`) — Playwright opens X in a headless browser with saved session cookies, scrolls the timeline, intercepts GraphQL API responses (`HomeTimeline`, `Trending`), parses them into a normalised tweet schema, and applies rule-based filters.
2. **LLM Digest** (`.opencode/skills/x-digest/SKILL.md`) — The `/digest` command runs the scrape pipeline then feeds the filtered JSON to the opencode agent, which uses the `x-digest` skill to produce a concise, scannable digest.

### Key modules

| File | Responsibility |
|------|----------------|
| `src/config.ts` | Loads and validates `config.yaml` via Zod schema |
| `src/scrape.ts` | Playwright browser automation, GraphQL interception, anti-detection |
| `src/parse.ts` | Walks nested GraphQL responses, extracts and normalises tweets/trends, deduplicates |
| `src/filter.ts` | Extensible filter registry — each filter is a function registered via `register()` |
| `src/pipeline.ts` | Phase 1 orchestrator (scrape → parse → filter) |
| `scripts/run.ts` | CLI entry point with `--scrape-only` and `--config` flags |
| `scripts/setup-auth.ts` | One-time headed browser login to save session cookies |
| `.opencode/skills/x-digest/SKILL.md` | Digest skill prompt for opencode agent |
| `.opencode/commands/digest.md` | `/digest` command — runs scrape and feeds output to LLM |

## Code Conventions

- **No comments** unless explaining non-obvious logic. The code should be self-documenting.
- **PascalCase** for component/type names, **camelCase** for functions/variables.
- **Strict TypeScript** — no implicit `any`. Use explicit types for function signatures. `unknown` over `any` where feasible; `any` is acceptable for deeply nested X API response traversal with a cast.
- **ESM only** — all imports use `.js` extensions per Node16 module resolution.
- **Error output to stderr**, data output to stdout. This allows piping `pnpm scrape` output into other tools.
- Filter functions are self-registering via the `register()` pattern — add a new filter by writing and registering a function, no wiring needed.

## Testing

```bash
pnpm test          # vitest run
pnpm test:watch    # vitest watch mode
pnpm typecheck     # tsc --noEmit
```

- Tests live in `tests/` mirroring `src/` structure.
- Test fixtures are sample GraphQL responses in `tests/fixtures/`.
- `writeFileSync` is mocked in tests to prevent file I/O.
- Filter tests use `makeTweet()` and `makeConfig()` factory helpers for concise test setup.

## Sensitive Files (never commit)

- `auth/storage-state.json` — full X session cookies
- `config.yaml` / `config.yml` — personal interests and blocked accounts
- `data/` — scraped feed data (timestamped subdirectories)

All are gitignored. Template `config.example.yaml` is committed instead.

## Common Tasks

### Adding a new filter

Add a function in `src/filter.ts` and call `register()`:

```typescript
register(function myNewFilter(tweet, config) {
  return tweet.metrics.views > 100; // return true to keep
});
```

### Changing the digest prompt

Edit `.opencode/skills/x-digest/SKILL.md`. This is the skill prompt used by the opencode agent when running `/digest`.

### Debugging scrape issues

Set `headless: false` in `config.yaml` to watch the browser. Check timestamped subdirectories under `data/` for captured GraphQL responses.
