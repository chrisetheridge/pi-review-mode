# ADR 0001: Dev-only review fixtures

## Status

Approved

## Context

Contributors need an easy way to test `/review`. Today they must edit arbitrary files before they can open the browser review UI. That slows manual smoke tests and makes demonstrations inconsistent.

Review mode already separates snapshot creation from the browser/server/prompt flow. The server accepts a `ReviewSnapshot`; it does not require a live Git working tree after the snapshot exists. We can use that boundary to feed a maintained fixture snapshot into the same runtime path.

The fixture path must not become normal user-facing behavior. Published/default `/review` should continue to use Git as the source of truth.

## Decision

Add a development-only fixture mode to `/review`:

```sh
PI_REVIEW_MODE_FIXTURES=1 pi -e ./
```

```text
/review --fixture basic
```

The extension will load a Git unified diff from:

```text
fixtures/review/<name>.diff
```

It will parse the diff with the existing diff parser, build a synthetic frozen `ReviewSnapshot`, and pass that snapshot to the existing browser review surface.

Rules:

- `--fixture <name>` only works when `PI_REVIEW_MODE_FIXTURES=1`.
- Without the env var, Pi reports a clear error and does not open the browser.
- `--fixture` cannot be combined with `--base`.
- Fixture names must be safe basenames. They may not include `/`, `\`, `..`, or require callers to type `.diff`.
- Unknown fixture names report available fixture names.
- Empty or invalid diffs fail before the browser opens.

Synthetic snapshot metadata:

- `repoRoot`: active Pi cwd when available, otherwise `process.cwd()`.
- `scope.kind`: `working-tree`, to avoid changing public review scope types for a dev-only path.
- `scope.label`: `Fixture: <name>`.
- `baseRef`: `fixture-base`.
- `headRef`: `fixture-head`.
- `id`: stable hash of fixture name and diff contents.

Extract stats, warning, and threshold helpers from `GitReviewSource` into a shared review module so Git snapshots and fixture snapshots use the same size behavior.

## Consequences

Contributors can run repeatable manual review tests without changing local files.

The fixture UI still uses a frozen snapshot. The browser does not inspect or mutate the working tree.

Maintainers can create fixtures with Git:

```sh
git diff --binary --find-renames HEAD > fixtures/review/<name>.diff
```

Plain `git diff HEAD` does not include untracked files unless the files are staged or marked with intent-to-add.

The first fixtures should stay small and readable:

- `basic.diff`: modified file and added file.
- `mixed.diff`: multi-file case with rename/delete/add and separated hunks, if practical.

Avoid binary fixtures at first because binary diffs add noise.

## Alternatives considered

### Full JSON snapshots

JSON snapshots would feed the browser exact runtime data. They are harder to read and can drift from parser behavior. Maintainers would need generation tooling or tedious manual edits.

### Fixture picker

A picker would improve discoverability but adds UI behavior that does not help the first smoke-test need. Unknown fixture names can list valid names instead.

### Public fixture/demo mode

A public fixture mode would make demos easier after install. It would also add non-Git behavior to the published command surface. The env var keeps fixture mode out of normal use.

## Test plan

Cover:

- `/review --fixture basic` parsing.
- Rejection when `--fixture` and `--base` are combined.
- Fixture source snapshot creation from a known `.diff` file.
- Unknown fixture errors with available fixture names.
- Command routing blocks fixture mode when `PI_REVIEW_MODE_FIXTURES` is not set.
