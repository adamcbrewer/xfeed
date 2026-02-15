# x-digest

A CLI tool that scrapes your personal X (Twitter) timeline and trending topics via a headless browser, applies configurable filters, then uses an opencode skill to produce a personalised daily digest via your local LLM.

Built with TypeScript, Playwright for browser automation, and [opencode](https://opencode.ai) for LLM-powered digest generation.

## How it works

```
Playwright headless browser
  → Scrolls your timeline / trending page
  → Intercepts GraphQL API responses (HomeTimeline, Trending)
  → Extracts structured tweet data (no DOM parsing)
  → Applies rule-based filters (keywords, accounts, language, engagement)
  → opencode /digest command feeds filtered data to your local LLM
```

X.com is a SPA that fetches data via internal GraphQL endpoints. Rather than scraping fragile HTML, this tool intercepts those API responses directly — getting richer data (impression counts, conversation IDs, card metadata) with better reliability.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (install via `corepack enable` or `npm i -g pnpm`)
- An **X (Twitter) account** you can log into in a browser
- **opencode** installed and configured with an LLM provider

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` to customise your digest:

```yaml
# Topics the LLM uses to rank and filter your feed
interests:
  - AI and machine learning
  - TypeScript and web development

# Always surface posts from these accounts
priorityAccounts:
  - openai

# Rule-based pre-filters (applied before LLM)
filters:
  blockKeywords:
    - "gm crypto fam"
    - "like if you agree"
  blockAccounts:
    - spambot123
  languages:
    - en
  minLikes: 5
  excludeRetweets: true
  maxAgeHours: 24
```

See `config.example.yaml` for the full list of options including scrape timing.

### 3. Authenticate with X

```bash
pnpm auth
```

This opens a visible browser window. Log in to your X account manually, then press Enter in the terminal. Your session is saved to `auth/storage-state.json` (gitignored).

You only need to do this once. Sessions typically last weeks/months. If a scrape fails with "Session expired", re-run `pnpm auth`.

## Usage

### Generate a digest (opencode)

In the opencode TUI, run:

```
/digest
```

This scrapes your timeline, applies filters, and feeds the result to your local LLM using the `x-digest` skill. The agent produces a personalised daily digest.

### Scrape only (no LLM)

```bash
pnpm digest:scrape-only
```

Runs scrape + parse + filter and outputs the filtered JSON to stdout. Useful for inspecting what data is captured before sending to the LLM.

### Pipeline only (phase 1)

```bash
pnpm scrape
```

Runs the scrape → parse → filter pipeline and prints filtered JSON.

### Custom config path

```bash
pnpm tsx scripts/run.ts --config path/to/config.yaml
```

### Output files

Each run writes intermediate files to a timestamped subdirectory under `data/` (all gitignored):

| File | Contents |
|------|----------|
| `data/<timestamp>/raw-feed.json` | Raw GraphQL response payloads from X |
| `data/<timestamp>/parsed-feed.json` | Normalised, deduplicated tweets and trends |
| `data/<timestamp>/filtered-feed.json` | After rule-based filters, with stats |

## Configuration reference

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `scrape` | `scrollCount` | `10` | Number of page scrolls (~4-6 tweets each) |
| | `scrollDelayMin` | `1.5` | Min seconds between scrolls |
| | `scrollDelayMax` | `3.5` | Max seconds between scrolls |
| | `headless` | `true` | Run browser headless (set `false` to debug) |
| | `scrapeTrends` | `true` | Also scrape trending topics |
| | `timeout` | `60` | Page load timeout in seconds |
| `filters` | `blockKeywords` | `[]` | Regex patterns to block (case-insensitive) |
| | `blockAccounts` | `[]` | Usernames to block (case-insensitive) |
| | `languages` | `["en"]` | Keep only these language codes |
| | `minLikes` | `0` | Minimum like count to keep |
| | `excludeRetweets` | `true` | Remove pure retweets (keeps quote tweets) |
| | `maxAgeHours` | `24` | Discard tweets older than this |

## Architecture

| Phase | Module | Purpose |
|-------|--------|---------|
| 1a | `src/scrape.ts` | Playwright headless browser + GraphQL interception |
| 1b | `src/parse.ts` | Normalize raw GraphQL responses into flat tweet schema |
| 1c | `src/filter.ts` | Rule-based filtering with extensible registry |
| 1d | `src/pipeline.ts` | Orchestrates scrape → parse → filter |
| 2 | `.opencode/skills/x-digest/SKILL.md` | Digest prompt for opencode agent |
| 3 | `.opencode/commands/digest.md` | `/digest` command — scrapes and feeds to LLM |

## Development

```bash
pnpm test              # run tests
pnpm test:watch        # watch mode
pnpm typecheck         # tsc --noEmit
```

### Adding a new filter

Filters use a registry pattern. Add a new filter function in `src/filter.ts`:

```typescript
register(function myFilter(tweet, config) {
  // return true to keep, false to discard
  return tweet.metrics.views > 100;
});
```

It's automatically included in the pipeline — no wiring needed.

## Auth & Security

| File | Contains | Gitignored |
|------|----------|------------|
| `auth/storage-state.json` | Full X session cookies | Yes |
| `config.yaml` | Personal interests, blocked accounts | Yes |
| `data/` | Your scraped feed data | Yes |

Session state contains your full X session cookies — treat it like a password. Never commit it.
