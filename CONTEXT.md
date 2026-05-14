# Pi Review Mode Context

## Scope

This repository owns a Pi extension package that provides `/review` for local Git change review. It does not own Pi core.

The extension:

1. Computes a frozen Git diff snapshot.
2. Opens a Glimpse-hosted native WebView for commenting on that frozen snapshot.
3. Stores review drafts in memory for the active native window session.
4. Converts saved comments into a structured Markdown prompt.
5. Writes that prompt into the active Pi editor for the user to edit and send manually.

## Domain Terms

- **Review mode**: the `/review` command exposed by this extension.
- **Review scope**: the set of Git changes being reviewed. Supported scopes are working-tree changes and branch-vs-base changes.
- **Working-tree review**: review of staged, unstaged, and untracked changes as a combined final diff against `HEAD`.
- **Branch review**: review of committed branch changes from merge-base to `HEAD`; requires a strictly clean working tree.
- **Frozen snapshot**: the immutable diff captured when review starts. Review comments refer to this snapshot, not live files. The frozen snapshot owns comment anchor lookup and validation.
- **Comment anchor**: structured position data for a file-level or diff-line comment, including file path, side, hunk, row index, line numbers, and line text.
- **Draft**: a saved review comment stored in memory for the active review window.
- **Review session**: the short-lived in-process owner of the snapshot, drafts, close, and submit lifecycle.
- **Review surface**: the UI host used to collect comments. The primary surface is a Glimpse native WebView that renders bundled web assets.
- **Generated prompt**: the Markdown feedback prompt written into the Pi editor after submit.
- **Review completion**: the submit-time conversion of saved drafts against the frozen snapshot into the generated prompt and completion result.

## Responsibilities

- `src/index.ts` registers `/review`, chooses a scope, starts review, and writes submitted prompts into the editor.
- `src/review/review-command.ts` parses `/review` arguments.
- `src/review/git-review-source.ts` detects Git state, resolves bases, creates snapshots, and enforces diff thresholds.
- `src/review/frozen-snapshot.ts` owns frozen snapshot helper behavior such as comment anchor lookup and validation while keeping snapshot data serializable.
- `src/review/diff-parser.ts` converts unified Git diffs into files, hunks, rows, and anchors.
- `src/review/in-process-review-session.ts` owns draft validation, seeded drafts, close, submit, and cleanup behavior without network auth.
- `src/review/review-prompt-builder.ts` creates the Markdown prompt from snapshot comments.
- `src/review/glimpse-review-surface.ts` opens the Glimpse native WebView, loads bundled browser assets, bridges messages, and resolves on submit/close/error.
- `apps/review-web/**` renders the review UI and calls the active review transport.
- `apps/review-web/src/glimpse-transport.ts` sends request/response messages through `window.glimpse`.
- `apps/review-web/src/use-review-surface-state.ts` owns review surface state such as loading, drafts, active editors, collapsed files, and submit eligibility.
- `test/review/**` verifies backend behavior with unit tests and Git fixtures.

## Architectural Rules

- Keep extension logic isolated from Pi core internals.
- Prefer explicit domain types in `src/review/types.ts` over ad hoc objects passed across modules.
- Treat Git output as untrusted input: handle missing bases, empty diffs, binary files, renamed files, paths with spaces, and large diffs with clear errors.
- Preserve snapshot immutability. Do not remap comments against changed files during an active review.
- Keep draft persistence ephemeral. Drafts are discarded after submit, close, or process exit.
- Keep prompt generation deterministic enough for snapshot tests.
- Glimpse bridge messages must never inspect or mutate the working tree; they operate only on the frozen snapshot and in-memory drafts.
- Native review submit must be blocked when there are no saved comments or when unsaved editors are open.
- Runtime review UI must use bundled local assets only.

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
- Do not add direct code editing in the review UI unless the product scope changes.
- Do not persist review history after the active session lifecycle ends.
- Do not auto-send generated prompts to an agent.
- Do not introduce split diff, syntax highlighting, threaded comments, search, or TUI behavior unless the product scope changes.
- Keep ADRs under `docs/adrs/` for approved architectural decisions; `CONTEXT.md` remains the shared domain glossary and boundary summary.
