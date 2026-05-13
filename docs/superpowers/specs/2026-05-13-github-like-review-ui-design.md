# GitHub-like Review UI Design

## Goal

Adapt the browser review UI to use a light, GitHub-like review chrome as the primary style. The current review behavior stays unchanged: users review a frozen Git snapshot, add file-level and line-level comments, then submit saved comments back to Pi as an editable prompt.

## Chosen approach

Use a direct visual refresh of the existing React UI and `@git-diff-view/react` renderer. Keep the current data flow, comment anchors, draft lifecycle, and submit behavior intact. Restyle the shell, sidebar, file headers, and diff renderer colors to match the provided reference image.

This is preferred over replacing the diff renderer because it gives the desired look with lower regression risk around line anchors, add-comment widgets, extension rows, tests, and scrolling behavior.

## Visual direction

The primary scene is a desktop review session in a bright browser window. The UI should feel like a native code review tool: calm, dense, predictable, and easy to scan.

- Default theme becomes light.
- Dark mode remains available as a secondary option.
- The layout uses a pale neutral page background, white panels, and thin cool-gray borders.
- The interface avoids strong branding in the review surface. The sidebar should feel like file navigation, not an app dashboard.
- Typography remains product-native: system/UI sans for chrome, monospace for paths and diff rows.

## Layout

### App shell

- Keep the two-column desktop layout.
- Sidebar width increases slightly to about 300px to support folder labels and search.
- Main pane remains a continuous vertical scroll of changed files.
- Use thin separators between sidebar and diff pane.
- Keep existing narrow-screen behavior reasonable, but mobile remains outside MVP scope.

### Sidebar

The sidebar should resemble the screenshot's file navigator:

- Top search field with placeholder `Filter files...`.
- Small adjacent filter/settings button.
- Recursive folder tree built from changed file paths.
- Folder rows show disclosure chevrons and folder icons.
- File rows show simple document icons and basename labels.
- Nested paths are indented by depth.
- Selected files use a subtle blue-tinted background or text treatment, not a heavy left accent.
- Saved comment counts remain visible, but as small badges that do not dominate the row.
- Status/addition/deletion details can remain available, but should be quieter than the tree structure.

### Main header

- Reduce the current branded header feel.
- Show compact review metadata: title, file count, additions/deletions, saved comments.
- Keep Close, theme toggle, and Finish Review/Submit controls accessible.
- Prefer compact button styling aligned with the reference chrome.

### File diff panels

Each changed file appears as a flat bordered panel:

- Header contains collapse chevron, full path, status/stat summary, and lightweight actions.
- Use a cool-gray header background.
- Stats on the right use green additions and red deletions.
- Keep file-level comment action near the header, but style it as a small review action rather than a large primary control.
- Avoid heavy rounded cards or dark dashboard styling.

### Diff renderer

Keep unified diff rendering through `@git-diff-view/react`, but override its CSS to match the reference:

- Hunk headers use a pale blue background.
- Added blocks use soft green backgrounds.
- Deleted blocks use soft red backgrounds.
- Context rows stay near-white.
- Line number gutters use muted gray text and slightly tinted backgrounds.
- Monospace rows are compact and horizontally scrollable for long lines.
- Comment extension rows blend into the diff while remaining clearly attached to the selected line.

## Behavior preserved

No user-visible review behavior changes beyond visual styling and the sidebar tree/search affordance.

Preserve:

- Frozen snapshot loading.
- File selection and scroll-to-file behavior.
- Collapse and expand behavior.
- File-level and line-level comments.
- Multiple unsaved editors.
- Save, edit, delete, cancel, and submit rules.
- Submit disabled with no saved comments or open unsaved editors.
- Tokenized localhost API behavior.

## Implementation notes

- Update `apps/review-web/src/App.tsx` for shell/header/sidebar composition.
- Update `apps/review-web/src/components/FileTree.tsx` to render a path tree and filter input.
- Update `apps/review-web/src/components/FileDiff.tsx` for file header and action styling.
- Add diff-renderer overrides in `apps/review-web/src/styles.css` rather than changing backend data structures.
- Tailwind design tokens in `apps/review-web/tailwind.config.ts` may be adjusted to make the light palette primary.
- Tests should focus on preserving interaction behavior while allowing class/style changes.

## Testing

Run targeted web tests for the UI components and state behavior, then the standard project checks:

```sh
pnpm test -- --run apps/review-web
pnpm check
pnpm build
```

Manual smoke test after build:

```sh
pnpm build
PI_REVIEW_MODE_FIXTURES=1 pi -e ./
/review --fixture basic
```

Verify the browser opens with the new light review chrome, comments can be saved, and submit writes the generated prompt into Pi.
