# ADR 0002: GitHub-like review UI

## Status

Approved

## Context

The browser review UI should feel closer to familiar code-review tooling. The target reference uses a light browser-like review chrome with a compact folder sidebar, flat file panels, dense monospace diff rows, and soft red/green hunk styling.

The review product behavior should not change. Users still review a frozen Git snapshot, add saved file-level or line-level comments, and submit those comments back to Pi as an editable prompt.

Replacing the diff renderer would add risk around anchors, add-comment widgets, extension rows, scrolling, and existing tests. The current React state model and `@git-diff-view/react` integration already support the required behavior.

## Decision

Use a direct visual refresh of the existing React UI and `@git-diff-view/react` renderer.

Rules:

- Light GitHub-like chrome is the primary/default style.
- Dark mode remains available as a secondary option.
- Preserve the existing frozen snapshot, draft, comment, collapse, close, and submit behavior.
- Keep unified diff rendering through `@git-diff-view/react`.
- Implement the new look through component structure, Tailwind classes, and local CSS overrides.
- Do not add external runtime assets or CDN dependencies.

Specific UI decisions:

- The app shell remains a two-column desktop layout.
- The sidebar becomes a compact file navigator with a `Filter files...` search field, a small filter/settings button, recursive folder rows, indented file rows, status badges, stats, and comment badges.
- The main header becomes review metadata and compact actions, not branded app navigation.
- File diffs render as flat bordered panels with cool-gray headers, right-aligned stats, and small review actions.
- Diff rows use pale blue hunk headers, pale green additions, pale red deletions, neutral context rows, muted line-number gutters, and compact monospace spacing.
- Comment extension rows remain clearly attached to their selected lines while visually blending with the diff.

## Consequences

The browser UI will look more like a standard code-review surface while keeping the extension's product semantics stable.

The sidebar gains client-side filtering and a recursive tree presentation derived from changed file paths. This affects only browser rendering; it does not change snapshot data or server APIs.

The project continues to depend on `@git-diff-view/react` for line rendering. Exact DOM control remains bounded by that library, but styling is sufficient for the requested chrome.

## Alternatives considered

### Replace the diff renderer

A custom table renderer would offer exact visual control, but would increase regression risk for comment anchors, add-widget behavior, hunk rendering, and horizontal scrolling.

### Restyle only the shell

Changing only the app shell would be safer, but would not satisfy the requested diff-renderer look.

### Remove dark mode

Removing dark mode would simplify styling, but retaining it avoids removing an existing user-visible control. Light mode is now primary.

## Test plan

Cover:

- Sidebar renders folders and file rows from changed paths.
- Sidebar filter hides non-matching files and keeps matching folder context.
- File selection, file collapse toggles, comment counts, and stats remain visible.
- The app defaults to light mode when no preference is stored.
- The theme toggle still switches between light and dark.
- File-level and line-level comment flows still save through the API.
- Submit remains disabled with no saved comments or open unsaved editors.

Run:

```sh
pnpm test -- --run apps/review-web
pnpm check
pnpm build
```

For manual smoke testing:

```sh
pnpm build
PI_REVIEW_MODE_FIXTURES=1 pi -e ./
/review --fixture basic
```
