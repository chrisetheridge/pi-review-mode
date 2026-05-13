# Agent Instructions

## Start here

This repo is `pi-review-mode`, a Pi extension package that adds `/review`. The command opens a tokenized localhost browser UI for commenting on a frozen Git diff, then writes the submitted review prompt into the active Pi editor with `ctx.ui.setEditorText`.

Before changing code, read:

1. `CONTEXT.md` for domain language, boundaries, and architectural rules.
2. `docs/agents/domain.md` for area-specific doc routing.
3. `README.md` for setup and manual smoke tests.
4. `docs/prd/2026-05-12-native-review-mode-prd.md` when changing user-visible review behavior.
5. `docs/superpowers/plans/2026-05-12-native-review-mode.md` when checking original implementation constraints.

## Code map

- `src/index.ts` — Pi extension entrypoint and `/review` command wiring.
- `src/review/**` — backend review domain: command parsing, Git source, diff parsing, sessions, server, prompt generation, browser surface.
- `apps/review-web/**` — React/Vite browser review UI.
- `test/review/**` — backend tests and Git fixtures.
- `apps/review-web/**/*.test.tsx` — web UI component tests.
- `docs/prd/**` — product requirements.
- `docs/superpowers/plans/**` — implementation plans and task breakdowns.

## Hard constraints

- Implement this as a Pi extension package, not Pi core.
- Do not modify Pi core or files under `packages/coding-agent/*`.
- Use public Pi extension APIs only, especially:
  - `pi.registerCommand("review", ...)`
  - `ctx.ui.select(...)`
  - `ctx.ui.notify(...)`
  - `ctx.ui.setEditorText(...)`
  - `ctx.hasUI`
- Git is the source of truth for review input.
- The browser UI reads a frozen snapshot. It must not inspect or mutate the working tree.
- The review server must bind to `127.0.0.1` and require the session token for API access.
- Submitted feedback must be written into the Pi editor and not automatically sent to the agent.
- Runtime browser assets must be bundled locally; do not add CDN runtime dependencies.

## Setup

Use pnpm:

```sh
pnpm install
```

## Verification

Default verification before completion:

```sh
pnpm check
pnpm build
```

Targeted commands:

```sh
pnpm typecheck
pnpm test -- --run
pnpm biome:check
pnpm biome:format
```

For behavior that affects the live extension flow, also perform the relevant manual smoke test from `README.md` with:

```sh
pnpm build
pi -e ./
```

## Build output

- `dist/` is generated build output.
- Do not hand-edit generated files.
- Prefer extension source changes under `src/**`, browser UI changes under `apps/review-web/**`, tests under `test/**`, and docs under `docs/**`.

## Issue tracker

GitHub Issues are the authoritative issue tracker for this repo.

Issue IDs in branch names, commit messages, and PR titles are optional, not required.

When an agent skill says to publish to the issue tracker, create a GitHub issue only if the user explicitly asked for issue creation. Otherwise, draft the issue content and ask for confirmation.
