# Pi Review Mode Context

## Scope

This repository owns a Pi extension package that provides `/review` for local Git change review. It does not own Pi core.

The extension:

1. Computes a frozen Git diff snapshot.
2. Serves that snapshot through a tokenized localhost browser UI.
3. Stores review drafts only for the active session.
4. Converts saved comments into a structured Markdown prompt.
5. Writes that prompt into the active Pi editor for the user to edit and send manually.

## Domain Terms

- **Review mode**: the `/review` command exposed by this extension.
- **Review scope**: the set of Git changes being reviewed. Supported scopes are working-tree changes and branch-vs-base changes.
- **Working-tree review**: review of staged, unstaged, and untracked changes as a combined final diff against `HEAD`.
- **Branch review**: review of committed branch changes from merge-base to `HEAD`; requires a strictly clean working tree.
- **Frozen snapshot**: the immutable diff captured when review starts. Browser comments refer to this snapshot, not live files. The frozen snapshot owns comment anchor lookup and validation.
- **Comment anchor**: structured position data for a file-level or diff-line comment, including file path, side, hunk, row index, line numbers, and line text.
- **Draft**: a saved review comment stored server-side for the active review session.
- **Review session**: the short-lived server-side owner of the snapshot, token, drafts, heartbeat, timeout, close, and submit lifecycle.
- **Review surface**: the UI host used to collect comments. The MVP surface is a local browser.
- **Generated prompt**: the Markdown feedback prompt written into the Pi editor after submit.
- **Review completion**: the submit-time conversion of saved drafts against the frozen snapshot into the generated prompt and completion result.

## Responsibilities

- `src/index.ts` registers `/review`, chooses a scope, starts review, and writes submitted prompts into the editor.
- `src/review/review-command.ts` parses `/review` arguments.
- `src/review/git-review-source.ts` detects Git state, resolves bases, creates snapshots, and enforces diff thresholds.
- `src/review/frozen-snapshot.ts` owns frozen snapshot helper behavior such as comment anchor lookup and validation while keeping snapshot data serializable.
- `src/review/diff-parser.ts` converts unified Git diffs into files, hunks, rows, and anchors.
- `src/review/review-session.ts` owns tokens, drafts, heartbeat, close, submit, expiry, and cleanup behavior.
- `src/review/review-server.ts` exposes the localhost HTTP API and serves bundled browser assets.
- `src/review/review-prompt-builder.ts` creates the Markdown prompt from snapshot comments.
- `src/review/browser-review-surface.ts` starts the server, opens the browser, and resolves on submit/close/expiry.
- `apps/review-web/**` renders the browser UI and calls the review server API.
- `apps/review-web/src/use-review-surface-state.ts` owns browser review surface state such as loading, drafts, active editors, collapsed files, and submit eligibility.
- `test/review/**` verifies backend behavior with unit tests and Git fixtures.

## Architectural Rules

- Keep extension logic isolated from Pi core internals.
- Prefer explicit domain types in `src/review/types.ts` over ad hoc objects passed across modules.
- Treat Git output as untrusted input: handle missing bases, empty diffs, binary files, renamed files, paths with spaces, and large diffs with clear errors.
- Preserve snapshot immutability. Do not remap comments against changed files during an active review.
- Keep draft persistence ephemeral. Drafts are discarded after submit, close, heartbeat expiry, hard timeout, or process exit.
- Require token authorization for all review API endpoints.
- Bind review servers to localhost only.
- Keep prompt generation deterministic enough for snapshot tests.
- Browser submit must be blocked when there are no saved comments or when unsaved editors are open.
- Runtime browser UI must use bundled local assets only.

## Verification Commands

Default checks:

```sh
pnpm check
pnpm build
```

Targeted checks:

```sh
pnpm typecheck
pnpm test -- --run
pnpm biome:check
pnpm biome:format
```

Manual extension smoke test:

```sh
pnpm build
pi -e ./
```

Use the smoke scenarios in `README.md` for working-tree review, branch review, explicit base review, submit behavior, and close/cancel behavior.

## Boundaries

- Do not modify `packages/coding-agent/*` or any Pi core package to implement this extension.
- Do not add direct code editing in the browser unless the product scope changes.
- Do not persist review history after the active session lifecycle ends.
- Do not auto-send generated prompts to an agent.
- Do not introduce split diff, syntax highlighting, threaded comments, search, or TUI behavior unless the product scope changes.
- Do not add ADRs yet; this repo is new and `CONTEXT.md` is the current architectural source of truth.
