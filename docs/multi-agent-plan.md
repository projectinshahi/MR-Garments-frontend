# Multi-Agent Development Plan

How the orchestrator (the main Claude Code session) and parallel screen agents build MR Garments screens
without conflicting.

## Roles

**Orchestrator (main session)** owns:
- architecture, dependencies, configs, lockfile
- root and route-group layouts (including `orders/[po]/layout.tsx`), `globals.css` tokens, font, navigation (`src/config/navigation.ts`), route registration
- shared components and their contracts (`docs/component-contract.md`), including the D5 `notInPrototype` helper
- shared data contracts and master data (types, master fixtures, accessors, formatters, `MOCK_TODAY`). Screen-specific fixtures belong to screen agents (D2)
- screenshot inventory, screen assignments, integration, conflict resolution, final validation

**Screen agent** (`.claude/agents/screen-builder.md`) owns exactly one screen: its route folder, its feature
folder, and its e2e spec, as listed in its assignment. It reports back and changes nothing else.

## Verified Claude Code capabilities (October 2026 docs)

| Capability | Fact | Source |
| --- | --- | --- |
| Concurrency | Background subagents run concurrently. Default cap is 20 per session (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). We plan 5 to 7. | code.claude.com/docs/en/sub-agents |
| Nesting | Subagents can spawn subagents by default. `screen-builder` omits the `Agent` tool, so it cannot. | sub-agents |
| Isolation | `isolation: worktree` in agent frontmatter gives each run a temporary git worktree under `.claude/worktrees/`, **branched from the default branch, not the current HEAD**. It is removed automatically if unchanged, and kept if it has changes. | /docs/en/worktrees |
| Dependencies in worktrees | `worktree.symlinkDirectories: ["node_modules"]` (set in `.claude/settings.json`) links the main `node_modules` into each worktree. | /docs/en/settings-reference |
| Per-agent restrictions | Settings `deny` rules apply to every session and cannot target one subagent. Restrictions use the frontmatter `tools` allowlist and frontmatter `hooks`. Hooks run only after the folder is trusted. | sub-agents, /docs/en/permissions |
| Hook shell on Windows | Git Bash if installed, otherwise PowerShell. `$CLAUDE_PROJECT_DIR` is the main checkout, even inside a worktree. | /docs/en/hooks |

Verified locally (not by spawning a real agent): with `node_modules` junctioned into a copy at
`.claude/worktrees/<name>/`, `next build`, `vitest` and `tsc` all pass. The same copy **outside** the repo fails
`next build`, because Turbopack refuses a `node_modules` link outside its root. On the first real spawn, confirm
the agent can run `npm run typecheck` in its worktree before relying on the setup.

**Not guaranteed:** that every agent starts at the same instant, or the exact scheduling of agents spawned in one
message. Plan for agents that start and finish at different times.

## Enforcement

| Rule | How it is enforced |
| --- | --- |
| No installs, shadcn CLI, or `git push` | `.claude/hooks/guard-screen-agent.mjs` (PreToolUse, exit 2) |
| No edits to shared files | Same hook. Denylist covers configs, `src/components`, `src/lib`, `src/types`, `src/mocks`, `src/config`, `src/hooks`, root and group layouts, `/preview`, `.claude/`, `docs/` |
| No edits outside the agent's worktree | Same hook (paths resolving outside `cwd` are blocked) |
| One screen per agent, no cross-screen edits | Assignment plus worktree isolation plus orchestrator diff review. Not machine-enforced between two feature folders |
| Same base for every agent | Orchestrator commits all shared preparation to `main` before spawning |

If Git Bash is missing and hooks fall back to PowerShell, `$CLAUDE_PROJECT_DIR` may not expand and the guard
would fail open. Check this once with a blocked command before a real run.

## Workflow

### Phase 0: Foundation (done)
Stack, shell, shared components, tokens, mock-data conventions, tests, and these docs.

### Phase 1: Screenshot intake (orchestrator, sequential)
1. Receive the screenshot directory path. Do not assume a path or filenames.
2. Inspect every file. Fill in `docs/templates/screenshot-inventory.md` as `docs/screenshot-inventory.md`, recording filename, dimensions, likely screen, variant (desktop/mobile/state), and route.
3. Record shared patterns: shell, sidebar, header, page header, tables, forms, badges, typography, colors, spacing, radii, shadows.
4. Map every screenshot to exactly one route and one owner.

### Phase 2: Shared preparation (orchestrator, before any agent starts). Done 2026-10-23; see build plan §10
1. Update tokens in `globals.css` (and fonts, if the references need them) to match the references. Check `/preview`.
2. Adjust the shell (sidebar, header) to match the references.
3. Finalize `src/config/navigation.ts` with every real route.
4. Add the **shared data contracts and master data** (D2): types in `src/types`, canonical master fixtures in `src/mocks/data` (suppliers, agents, transport companies, offices/warehouses, teams, item master, users, roles, current user), accessors in `src/lib/data`, formatters, and `MOCK_TODAY`. **Screen-specific fixtures are not written here.** Each screen agent writes its own in `src/features/<feature>/data/`, faithful to its screenshots (D1).
5. Add any shadcn components or dependencies the screens need, and extend `docs/component-contract.md`.
6. Write one assignment per agent from `docs/templates/screen-assignment.md`.
7. Run `npm run validate`, then commit everything to `main`. Worktrees branch from `main`.

### Phase 3: Parallel screen build
- Group screens into independent work units. A list screen and its detail/edit screens for the same entity go to one agent. Never split one route folder or one feature folder across agents.
- Spawn up to 7 `screen-builder` agents in one message, each with its full assignment text in the prompt, running in the background.
- Each agent gets a unique dev port (3001 to 3007) and `E2E_PORT` (3101 to 3107).

### Phase 4: Integration (orchestrator)
For each finished agent, one at a time:
1. Read its report and review the diff in its worktree branch. Reject any change outside the owned paths.
2. Handle "requests for the orchestrator" centrally (tokens, shared components, data fields). If that changes a shared contract, update every consumer.
3. Merge the branch into `main`, then run `npm run validate` and `npm run test:e2e`.
4. Send follow-up fixes to the same agent (SendMessage keeps its context) instead of spawning a new one.

### Phase 5: Final verification
Work through `docs/validation-checklist.md`.

## Fallback: same-worktree mode

Use this if worktrees are unavailable or the `node_modules` link fails.
- Remove `isolation: worktree` from the agent file, or override it at spawn time.
- Ownership must be strictly disjoint. The hook still blocks shared files.
- All agents share one `.next` directory, so **agents must not run `npm run build` or `npm run test:e2e`**. They run lint, typecheck, and Vitest only, and use the orchestrator's single dev server. The orchestrator runs build and e2e after the agents finish.
- `npm run typecheck` and `npm run lint` see every agent's in-progress files. An agent fixes errors in its own files only and reports others.

## Ownership plan

The ownership matrix (three waves of up to 7 agents) is in `docs/proposed-build-plan.md` §6, and the shared-file
conflict table is in §7. Each agent owns exactly:
- its route folder(s) under `src/app/(app|staff|auth)/`
- `src/features/<feature>/**`, including `data/` (D2)
- `e2e/<agent-name>.spec.ts`

Within a wave, agent n uses dev port `300n` and `E2E_PORT` `310n`.
