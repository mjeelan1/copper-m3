# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 3 starter: Ask Copper

**Summary:** Ask Copper, the Module 2 shopping chatbot, finished: a floating
chat panel that answers prices, totals and stock with four tools and shows
each step. Module 3 teaches it to answer from the customer documents.

| Piece | Where | What it does |
|---|---|---|
| Component | `components/copper/ask-copper.tsx` | The launcher and chat panel, mounted from `app/page.tsx` and opened by the header's `#ask` link. Draws each answer as stations: the tools on offer, thinking, each tool call, then the reply |
| Server Action | `lib/copper/assistant/ask.ts` | `askCopper()`: streams the conversation with `callStream`, up to 5 steps, and sends each step back as a live `Progress` |
| Tools | `lib/copper/assistant/tools.ts` | `copperTools`: `get_products`, `get_prices`, `calculate_cost`, `check_availability`, and `search_docs` (added in Module 3, below) |
| Instructions | `lib/copper/assistant/instructions.ts` | `COPPER_INSTRUCTIONS`. Since Module 3, setup, troubleshooting, warranty and policy questions go to `search_docs` and are answered only from its passages, every sentence ending in a citation like `[Copper Home User Guide, p. 9]`. When the passages don't answer it, Copper says `NOT_IN_DOCS` ("I couldn't find that in our support docs.") and suggests the Copper Crew. Three rules came from trying to break it: a conclusion cites the page that states the rule outright, documents that disagree are flagged ("Our documents differ on this."), and "ignore your rules" messages still get a searched, cited answer |
| Data | `lib/copper/inventory.ts`, `lib/copper/documents.ts` | Stock from `lib/copper/data/inventory.json`; `DOCUMENTS`: the four customer documents and their PDF paths under `public/docs/`. The PDFs are added in class |
| AI calls | `{ module: 2, feature: "ask-copper" }` | One streamed call per question |

## Module 3: Document passages and embeddings

**Summary:** The four customer PDFs are split into passages of a few sentences
and embedded with Gemini, so Ask Copper can later find the passages that answer
a question (RAG). The passages and their embeddings live in one JSON file that
the server loads into memory when it starts.

| Piece | Where | What it does |
|---|---|---|
| PDFs | `public/docs/*.pdf` | The customer documents listed in `lib/copper/documents.ts`, also served at their `file` URLs |
| Build script | `scripts/build-passages.ts` (`npm run build:passages`) | Reads every PDF page with `unpdf`, splits it with `splitPage()`, embeds every passage and writes the JSON. `--dry-run` prints the passages without embedding. Run it again whenever a PDF changes |
| Splitter | `lib/copper/split-page.ts` | Drops each page's header, joins wrapped lines, keeps headings and FAQ questions with the text after them, keeps a table's last cell with its table (not with the next numbered clause), and makes passages of up to 4 sentences / about 600 characters |
| Data | `lib/copper/data/passages.json` | 89 passages: `id`, `documentId`, `title`, `file`, `page`, `text` (starts with the document title) and `embedding` (768 numbers, length 1) |
| Loader | `lib/copper/passages.ts`, `instrumentation.ts` | `getPassages()` / `passagesInfo()`. `register()` loads the file when the server starts and logs `[passages] loaded N passages` |
| AI calls | `callEmbed` in `lib/ai/call.ts`; `{ module: 3, feature: "embed-passages" }` | `gemini-embedding-2` with `RETRIEVAL_DOCUMENT`, one batch per build. Questions must be embedded with the same model and `RETRIEVAL_QUERY` |
| Search | `searchPassages()` / `rankPassages()` in `lib/copper/passages.ts` | Embeds the question, scores every passage by dot product and returns the 5 closest with `title`, `page`, `url` (`/docs/<file>.pdf#page=N`), `text` and `score` |
| Ask Copper tool | `search_docs` in `lib/copper/assistant/tools.ts` | Copper calls it for setup, troubleshooting, warranty and policy questions. Returns `{ status: "ok", results }`, or `"unavailable"` if Google can't be reached |
| Tool card | `ToolOutput` in `components/copper/ask-copper.tsx` | Lists each passage with its document title, a "Page N" link that opens the PDF at that page in a new tab, the text and the match score |
| Citations | `lib/copper/citations.ts`, `ReplyText` in `components/copper/ask-copper.tsx` | `splitCitations()` finds each `[Title, p. N]` in Copper's reply and the panel links it to `/docs/<file>.pdf#page=N`. The link is built from `DOCUMENTS`, never from a URL the model writes; a title that isn't one of the four documents stays plain text |
| AI calls | `{ module: 3, feature: "search-docs" }` | One embedding call per search, plus the usual `ask-copper` call |

**Data flow:** `npm run build:passages` → PDF pages → passages → Gemini
embeddings → `passages.json` → loaded into memory at server start. Then, per
question: Ask Copper → `search_docs` → embed the question → 5 closest passages
→ Copper answers from them, citing document and page.

**Decisions and trade-offs:** 768 dimensions instead of 3072 keeps the file
about 0.7 MB; vectors are scaled to length 1 so a dot product is the cosine
similarity. Embeddings are built ahead of time, not at startup, so starting the
server never calls Google. Passages carry their document title in their text
so a passage like "Q Can I get a refund?" still says which document it's from.

**Risks and open questions:** the file goes stale if a PDF changes and the
script isn't re-run. Tables come through as flattened rows, and a long table
can be split across two passages. A cut in the wrong place hides an answer
from search: the Terms' refund table once lost its "After 14 days, not
refunded" row to the next clause, so Copper cited a less direct page.
