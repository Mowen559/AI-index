# Hub Web Fusion Assessment And Production Plan

## Summary

`hub-web` is currently a fusion shell, not a production-complete main program.

Its current integration pattern is:

1. `codebase-memory-mcp` provides the indexing entrypoint and the graph database that powers the main visualization.
2. `GitNexus` provides Git history, diff, restore, shadow history, and some file analysis helpers.
3. `Understand-Anything` provides the product framing, explanation layer, and metadata concepts such as summaries, tags, and complexity.
4. `supermemory` is present only as a placeholder chat/log layer.
5. `codegraph` is installed as a dependency, but it is not yet the main execution path inside `hub-web`.

So the current state is not "fully fused and working". It is better described as "partially fused, with real backend links in some paths and mock or hardcoded behavior in others".

## Current Capability Map

| Area | Primary System | Current Status | Notes |
|---|---|---|---|
| Project initialization | `codebase-memory-mcp` | Real | `src/app/api/analyze/route.ts` directly launches the indexer |
| Main graph data | `codebase-memory-mcp` | Real | `src/app/api/project-graph/route.ts` reads the SQLite cache DB |
| File analysis graph edges | `codebase-memory-mcp` | Real | `src/app/api/analyze-file/route.ts` queries DB nodes and edges |
| File summary/tags/complexity | `Understand-Anything` | Partial | Metadata is loaded from several possible JSON files if present |
| Local git history | `GitNexus` | Real | `src/app/api/file-git-history/route.ts` dynamically imports GitNexus helpers |
| Shadow git history | `GitNexus` | Real | Same route, plus related shadow-git usage |
| Git diff/restore | `GitNexus` style utilities | Likely real | Wired into UI flow, but not fully end-to-end verified in this pass |
| AI history storage | Local SQLite helper | Real but local-only | `src/app/api/ai-git/route.ts` writes to `.ai_history.db` |
| Supermemory chat | `supermemory` | Mock | `src/app/api/supermemory-chat/route.ts` returns simulated text |
| Supermemory logs | `supermemory` | Unknown/likely placeholder | Not verified end-to-end |
| CodeGraph integration | `codegraph` | Dependency only | Present in package deps, not clearly driving main runtime paths |

## What Is Actually Working Today

### Working with real implementation

- Starting project analysis through `codebase-memory-mcp`
- Reading graph nodes and edges from the generated SQLite database
- Rendering a graph-oriented workspace around those graph results
- Loading file-level structure and relationships from the same database
- Loading git history through `GitNexus` runtime helpers
- Recording AI file history into `.ai_history.db`

### Partially working or environment-coupled

- File metadata enrichment from `Understand-Anything`
- File diff and restore flows
- Shadow Git workflows
- Dynamic graph expansion after file selection

These are connected in code, but still rely on rigid paths, local assumptions, or unverified runtime contracts.

### Not production-ready

- `supermemory` chat is explicitly mocked
- `Understand-Anything` semantic pipeline completion is partly simulated in `analyze`
- `hub-web` startup is fragile because the monorepo dependency/runtime story is not stabilized
- The current data loading assumes a specific local folder layout, especially around `../GitNexus` and cache DB naming
- There is no single orchestrated "fusion runtime" contract between the systems

## Key Technical Findings

### 1. `codebase-memory-mcp` is the real graph backbone right now

`src/app/api/analyze/route.ts` launches the `codebase-memory-mcp` executable and streams status logs to the UI.

`src/app/api/project-graph/route.ts` then reads a SQLite DB from a derived cache path and uses that as the graph source.

This means the main graph experience is currently anchored to `codebase-memory-mcp`, not `codegraph` and not `Understand-Anything`.

### 2. `GitNexus` is the real Git and repo-evolution layer

`src/app/api/file-git-history/route.ts` imports:

- `gitnexus/dist/server/shadow-git.js`
- `gitnexus/dist/server/git-history.js`

That is a genuine runtime dependency on `GitNexus`.

`src/app/api/ai-git/route.ts` also implements shadow-history-like storage locally via `.ai_history.db`, which overlaps conceptually with the GitNexus side.

This creates a duplication risk: part of AI history is local to `hub-web`, while part is delegated to GitNexus.

### 3. `Understand-Anything` is currently more of a metadata and UX layer than a runtime core

`src/app/api/analyze-file/route.ts` tries to enrich file analysis with:

- summary
- tags
- complexity

by reading possible `knowledge-graph.json` files from several locations.

That means the `Understand-Anything` part is currently opportunistic enrichment, not guaranteed structured execution.

Also, `src/app/api/analyze/route.ts` contains a simulated completion step for "semantic mapping", which signals incomplete real integration.

### 4. `supermemory` is not truly integrated yet

`src/app/api/supermemory-chat/route.ts` contains a mocked response with explicit text saying it is not a real integration.

So `supermemory` should be treated as a planned subsystem, not a completed one.

### 5. `codegraph` is present but not yet operationally central in `hub-web`

Even though `@colbymchenry/codegraph` is listed in `package.json`, the visible runtime path in `hub-web` still routes through:

- `codebase-memory-mcp` for graph data
- `GitNexus` for git/repo history
- optional `Understand-Anything` JSON for metadata

This means `codegraph` is currently "included in the stack" but not yet "established as the source of truth".

## Main Gaps Blocking Production

### Product-level gaps

- No clear source-of-truth ownership per subsystem
- Overlap between GitNexus and local AI history logic
- Placeholder `supermemory` chat experience
- Incomplete `Understand-Anything` runtime pipeline

### Runtime gaps

- Hardcoded relative paths to sibling projects
- Cache DB lookup is derived from local path naming instead of a stable config
- Startup depends on monorepo state being perfect
- No service health layer that validates all required subsystems before entering dashboard mode

### Architecture gaps

- No unified adapter boundary for graph provider, git provider, memory provider, or explanation provider
- UI components mix product concepts from different systems without a formal backend contract
- No integration test matrix proving the fused system works as a whole

## Recommended Production Direction

The fastest route is not to "blend everything equally".

The fastest route is to define one source of truth per concern:

- Graph/index source of truth: choose `codebase-memory-mcp` or `codegraph`
- Git/change intelligence source of truth: choose `GitNexus`
- Explanation metadata source of truth: choose `Understand-Anything`
- Memory/chat source of truth: choose `supermemory`

Then `hub-web` becomes an orchestration UI over clean adapters instead of a pile of direct local assumptions.

## Proposed Phased Plan

### Phase 0: Stabilize The Runtime

Goal: make `hub-web` boot reliably on one machine.

Tasks:

- Add a single environment/config file for all sibling project locations
- Remove hardcoded `../GitNexus` assumptions from API routes
- Standardize cache DB discovery
- Add startup health checks for:
  - graph DB available
  - GitNexus helpers available
  - optional metadata file availability
  - supermemory availability
- Make dashboard show degraded-mode banners instead of silently failing

Exit criteria:

- `hub-web` starts from a clean environment
- dashboard loads without manual path edits
- missing subsystems are shown clearly in UI

### Phase 1: Make The Current Fusion Honest

Goal: remove fake integration and label all degraded features clearly.

Tasks:

- Replace mocked `supermemory-chat` with:
  - real integration, or
  - temporary disabled state in UI
- Replace simulated `Understand-Anything` completion logging with real status or explicit "not enabled"
- Audit all API routes and tag each as:
  - production
  - experimental
  - mock
- Surface those states in the UI

Exit criteria:

- no route pretends to be real when it is mocked
- every feature has an explicit readiness state

### Phase 2: Introduce Adapter Boundaries

Goal: stop coupling UI directly to sibling project internals.

Create four adapters:

- `GraphProvider`
- `GitProvider`
- `ExplanationProvider`
- `MemoryProvider`

Each route should call an adapter, not directly reach into random sibling folders or package internals.

Suggested responsibility split:

- `GraphProvider`: graph loading, file edge expansion, node type filters
- `GitProvider`: file history, diff, restore, shadow history
- `ExplanationProvider`: summary, tags, complexity, onboarding analysis
- `MemoryProvider`: chat, retrieval, logs

Exit criteria:

- swapping the graph engine does not rewrite UI routes
- backend ownership is explicit per feature

### Phase 3: Choose The Graph Source Of Truth

Goal: remove graph duplication and ambiguity.

Decision required:

1. Keep `codebase-memory-mcp` as the graph backbone and use `codegraph` only optionally
2. Migrate graph backbone to `codegraph`
3. Support both through a single provider contract

Recommended short-term choice:

- keep `codebase-memory-mcp` as primary until `hub-web` is stable
- treat `codegraph` as a future backend behind the same provider interface

Reason:

- that matches the current real runtime path
- it minimizes rewrite cost

Exit criteria:

- one graph contract
- one authoritative graph data path in production mode

### Phase 4: Consolidate Git And AI History

Goal: avoid duplicate history systems.

Tasks:

- Decide whether `.ai_history.db` remains local to `hub-web` or is absorbed into GitNexus-oriented storage
- Unify shadow history, local history, and restore behavior
- Ensure diff views use one consistent backend model

Exit criteria:

- one AI history model
- one restore flow
- one diff source per scenario

### Phase 5: Real Supermemory Integration

Goal: turn chat from demo mode into product value.

Tasks:

- replace mock route with actual `supermemory` request path
- define memory scoping by project and file
- connect graph/file context into retrieval prompt building
- add streaming responses

Exit criteria:

- chat answers are real
- memory retrieval is scoped and testable
- UI logs reflect actual backend events

### Phase 6: End-To-End Fusion Testing

Goal: verify the main program, not just isolated subsystems.

Test suites should cover:

- clean startup
- project initialization
- graph load
- file selection
- right panel analysis
- git history
- diff and restore
- chat with project context
- degraded mode when one subsystem is unavailable

Exit criteria:

- one green E2E suite for the fused application

## Delivery Priority

If the goal is "usable main program fast", do this order:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 4
5. Phase 5
6. Phase 3
7. Phase 6

Reason:

- runtime stability and honest feature states matter more than backend elegance
- supermemory should not be treated as done until it is real
- graph-source replacement should happen after the orchestration shell is stable

## Recommended Immediate Next Actions

### Option A: Productionize the current stack with minimal rewrite

- Keep `codebase-memory-mcp` as graph source
- Keep `GitNexus` as git source
- Keep `Understand-Anything` as metadata/enrichment source
- Replace mocked `supermemory`
- Add adapters and config

Best when:

- you want the fastest path to a usable internal tool

### Option B: Re-architect toward `codegraph` as future core

- First stabilize `hub-web`
- Then move graph responsibilities behind `GraphProvider`
- Then swap implementations carefully

Best when:

- you want a cleaner long-term architecture
- you are willing to delay near-term delivery

## Final Recommendation

Treat `hub-web` as a fusion orchestrator with a temporary backend mix, not as a finished unified product.

The right next step is:

- stabilize the runtime
- remove mock behavior
- formalize provider boundaries
- only then decide whether to keep or replace the current graph backbone

That is the safest path to a real main program.
