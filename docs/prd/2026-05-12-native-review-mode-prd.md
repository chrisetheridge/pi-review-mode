# Native Review Mode PRD

## Summary

Pi adds a native `/review` command for reviewing Git changes before asking an agent to respond. The command opens a local browser review UI, shows a frozen unified diff, lets the user add file-level and line-level comments, then writes a structured Markdown prompt into the Pi editor. The user can edit that prompt before sending it to the agent.

The MVP uses Git as the source of truth. It does not try to reconstruct which changes came from the current Pi session.

## Goals

- Give Pi users a GitHub-like review flow for local changes.
- Let users comment on specific changed, removed, and context lines.
- Let users submit review feedback as an editable prompt for the active agent.
- Keep the first UI browser-based while preserving an internal surface abstraction for future hosts.
- Use current, well-maintained libraries where they help, especially for diff parsing and UI foundations.

## Non-goals

- Direct code editing in the browser.
- Split diff.
- Syntax highlighting.
- Threaded comments, replies, or resolved/unresolved lifecycle.
- Search.
- Review progress or read/unread state.
- Stale snapshot detection or comment remapping.
- Persisted review history after submit, close, or timeout.
- Terminal TUI implementation.
- Monaco/editor integration.
- Preserving staged/unstaged boundaries after feedback.
- Mobile support.

## Command surface

### `/review`

Runs inside a Git repository and opens a terminal scope picker before launching the browser UI.

Available scopes:

1. **Working tree changes**
   - Includes staged changes, unstaged changes, and untracked files.
   - Shows the combined final diff against `HEAD`.

2. **Branch vs base**
   - Compares current `HEAD` against the merge base with an auto-detected base branch.
   - Includes committed branch changes only.
   - Requires a strict clean working tree: no staged, unstaged, or untracked changes.

If no reviewable changes exist, Pi shows a no-op message and does not open the browser.

### `/review --base <branch>`

Skips the scope picker and opens branch-vs-base review directly.

Rules:

- Compares current `HEAD` against the merge base with `<branch>`.
- Requires strict clean working tree.
- Blocks with a clear error if `<branch>` is invalid, merge-base fails, or no diff exists.

No other flags ship in the MVP.

## Base branch detection

For `/review`, Pi detects the base branch automatically for the branch-vs-base option.

Detection order:

1. upstream target if configured
2. `origin/main`
3. `origin/master`
4. `main`
5. `master`

If detection fails, Pi can still offer working tree review if working tree changes exist. Branch review remains unavailable unless the user uses `/review --base <branch>`.

## User flow

1. User runs `/review`.
2. Pi verifies the current directory is inside a Git repository.
3. Pi computes available review scopes.
4. Pi shows a terminal scope picker.
5. User selects a scope.
6. Pi creates a frozen diff snapshot.
7. Pi starts a localhost-only review server with a one-time tokenized URL.
8. Pi opens the browser review UI.
9. User reviews continuous unified diffs, expands or collapses files, and adds comments.
10. User submits saved comments.
11. Pi generates a structured Markdown prompt and overwrites the editor contents with it.
12. User edits the prompt if needed, then sends it to the agent manually.

Special cases:

- `/review --base <branch>` skips the picker.
- Branch review blocks when the working tree is not strictly clean.
- Submit is blocked when there are zero saved comments.
- Submit is blocked while any unsaved comment editor is open.

## Browser review UI

The browser UI targets desktop browsers. Mobile layout is not part of the MVP.

Layout:

- Sticky left sidebar with a changed-file tree.
- Main pane with one continuous scroll through all changed files.
- Unified diff only.
- Horizontal scrolling for long diff lines.
- No syntax highlighting in the first version.

Sidebar:

- Shows only changed files.
- Groups files by path as a tree.
- Shows file status: modified, added, deleted, renamed, untracked, binary.
- Shows additions/deletions.
- Shows saved comment count per file.
- Clicking a file expands it and scrolls to it.

File diff:

- File header with path, status, stats, and collapse/expand control.
- File-level comment button at the top of each file.
- Hunk headers.
- Old and new line numbers.
- Red removed lines, green added lines, neutral context lines.
- All visible diff lines accept comments.
- Binary files show metadata and allow file-level comments only.
- Untracked text files render as all-added diffs.
- Deleted text files render as all-removed diffs.
- Renamed files show rename metadata and render content diffs when content changed.

## Comment behavior

MVP supports file-level comments and line-level comments.

Rules:

- One saved draft per anchor.
- Anchors can target file-level comments or any visible diff line.
- Users can open multiple unsaved comment editors.
- Comment editor is a plain textarea.
- Users can type arbitrary text, Markdown, and code snippets.
- No Markdown preview.
- Save via button or `Cmd/Ctrl+Enter`.
- `Esc` closes/cancels the active editor.
- Saved comments render as cards.
- Saved comments can be edited or deleted.
- Submit includes saved comments only.
- Submit blocks while unsaved editors exist.

File-level comments appear under the file header, above the hunks.

## Comment anchor model

Each comment anchor stores structured position data from the frozen snapshot:

- file path
- anchor type: `file` or `line`
- side: `old`, `new`, `context`, or `file`
- hunk index or hunk header
- old line number, when available
- new line number, when available
- diff row index within the file
- line text

This avoids ambiguity when the same line text appears in multiple hunks. The generated prompt also includes the selected line and a compact hunk snippet so the agent can inspect the current file and understand the original review context.

## Data loading

Pi freezes the diff snapshot when review starts. The browser reads only from that snapshot.

Loading behavior:

- Initial browser load receives manifest, sidebar tree, file stats, and global stats.
- File diffs load on demand from the frozen snapshot.
- The browser starts background prefetch after boot.
- Selected and nearby files get prefetch priority.
- Comments for collapsed or not-yet-loaded files still submit because saved drafts live server-side.

## Draft storage

Saved comments live server-side for the active review session.

Behavior:

- Browser reload restores saved drafts.
- Unsaved textarea contents remain client-side only.
- Drafts are discarded after submit, close, heartbeat expiry, hard timeout, or Pi process exit.
- Pi does not write separate review metadata into the session history for MVP.

## Security and lifecycle

Review server requirements:

- Bind to `127.0.0.1` only.
- Generate an unguessable one-time token in the review URL.
- Require the token for snapshot, file, draft, submit, heartbeat, and close endpoints.
- Serve only the frozen diff snapshot and bundled frontend assets.
- Do not use CDN assets at runtime.

Cleanup:

- Submit cleans up the review session.
- Explicit Close Review button cleans up the review session.
- Browser sends heartbeat every ~15 seconds.
- Server cleans up after ~60 seconds without heartbeat.
- Server hard-times out after 2 hours.

Failure fallback:

- If normal submit succeeds, Pi populates the editor.
- If submit fails, the browser shows a copyable generated prompt or saved comment summary when possible.

## Large diff behavior

Before opening the browser, Pi computes diff stats.

Thresholds:

- Warn before opening if the diff exceeds 50 files or 5,000 changed lines.
- Hard stop if the diff exceeds 500 files or 50,000 changed lines.

The warning lets the user continue. The hard stop tells the user to narrow the review or split the work.

## Prompt generation

Pi generates structured Markdown and places it in the editor. Pi overwrites existing editor content; the user controls when to submit the generated prompt.

Prompt contents:

- Scope metadata: working tree or branch vs base.
- Snapshot timestamp.
- Frozen snapshot warning.
- Instructions:
  - Inspect current files before editing because the review used a frozen diff snapshot.
  - Address direct change requests.
  - Answer or ask for clarification for questions and ambiguous feedback.
  - Do not blindly satisfy contradictory comments.
  - Run relevant project checks if discoverable.
  - Summarize changes and verification.
- Files in diff order.
- File-level comment first.
- Line comments in diff position order.

Each line comment includes:

- `path:line` reference where possible.
- Side label: old, new, or context.
- Hunk header or hunk index.
- Selected diff line.
- Compact hunk snippet around the comment.
- User feedback text.

Example shape:

```md
Address the following code review feedback for the current changes.

Scope: Working tree changes
Snapshot: 2026-05-12T14:32:00Z

Instructions:
- Inspect current files before editing. This review was based on a frozen diff snapshot.
- For direct requests, update the code.
- For questions or ambiguous feedback, answer or ask for clarification before changing.
- Do not blindly satisfy contradictory comments.
- Run relevant project checks if discoverable, then summarize changes and verification.

## src/foo.ts

### File comment

Feedback:
Explain why this file needed a new abstraction.

### Comment 1: src/foo.ts:42, new line 42

Hunk: @@ -39,6 +39,8 @@

Diff context:

```diff
  const retries = 3;
+ const timeoutMs = 5000;
  await runJob();
```

Feedback:
Why is this hard-coded?
```

## Internal architecture

Core modules:

- `ReviewCommand`: parses `/review` and `/review --base <branch>`.
- `GitReviewSource`: detects repo state, base branch, available scopes, file status, stats, and frozen diffs.
- `DiffParser`: converts unified diff into files, hunks, rows, and comment anchors.
- `ReviewSession`: owns snapshot, server-side drafts, token, heartbeat, timeout, and submit lifecycle.
- `ReviewPromptBuilder`: converts saved comments into Markdown.
- `ReviewSurface`: abstraction for opening a review UI.
- `BrowserReviewSurface`: MVP review surface that starts the local server and opens a browser.
- `ReviewWebApp`: bundled React/Tailwind frontend served from local static assets.

Library guidance:

- Prefer current, maintained libraries over custom code where they reduce risk.
- Use a well-supported diff parser if it handles Git unified diff edge cases better than custom parsing.
- Pi owns the rendered diff UI and comment interactions.
- Do not adopt a prebuilt visual diff component if its DOM or styling constrains the desired GitHub-like UI.
- Use the usual modern frontend stack for the browser app: React, Tailwind, and shadcn-style components where they fit.
- Bundle all frontend assets with Pi. Runtime review UI must load assets only from localhost.

## Acceptance criteria

- `/review` works inside Git repositories and errors clearly outside Git repositories.
- `/review` shows a terminal scope picker unless `--base` is provided.
- `/review --base <branch>` opens branch review directly and requires strict clean working tree.
- Working tree review includes staged, unstaged, and untracked files as combined final diff against `HEAD`.
- Branch review compares `HEAD` to merge-base with detected or provided base.
- Branch review is unavailable or blocked when the working tree is not strictly clean.
- Browser UI shows continuous unified diff with sticky file tree sidebar.
- Users can expand and collapse files.
- Users can add, edit, and delete saved file-level and line-level comments.
- Comments can attach to all visible diff lines.
- Saved drafts survive browser reload during the live session.
- Submit blocks with zero comments or unsaved editors.
- Submit overwrites Pi editor with structured Markdown prompt.
- Server binds to localhost, requires token auth, and cleans up through submit, close, heartbeat expiry, or timeout.
- Large diff warning and hard-stop thresholds work.
- Runtime browser UI does not depend on internet access or CDN assets.

## Testing strategy

- Git fixture tests for working tree, staged, unstaged, untracked, deleted, renamed, binary, and branch-vs-base cases.
- Base detection tests for upstream, `origin/main`, `origin/master`, `main`, `master`, and failure cases.
- Strict-clean checks for branch review.
- Diff parser tests for hunks, old/new/context anchors, repeated lines, no-newline markers, file additions, file deletions, and renames.
- Prompt builder snapshot tests.
- Review session lifecycle tests for token auth, saved drafts, heartbeat expiry, hard timeout, submit cleanup, and close cleanup.
- Frontend component tests for file tree, collapse/expand, comment add/edit/delete, unsaved editor blocking, and disabled submit.
- Manual browser smoke test in a real Pi session.

## Risks

- Git diff edge cases can break comment anchors if the parser model is weak.
- Large diffs can stress browser memory and rendering performance.
- Browser/Pi lifecycle cleanup can fail if heartbeats or server teardown behave differently across browsers.
- Editor overwrite semantics may surprise users, though MVP intentionally keeps the user in control.
- Base branch detection can be wrong in unusual branch setups.
- Third-party parser or UI dependencies can constrain behavior if chosen too early without validating edge cases.
