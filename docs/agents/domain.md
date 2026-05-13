# Domain Routing

Read the context that matches the area you are changing before exploring code deeply.

Always read root `CONTEXT.md` first for shared domain language, boundaries, and architectural rules.

| Area | Code paths | Read when | Additional docs |
| ---- | ---------- | --------- | --------------- |
| Extension command | `src/index.ts`, `src/review/review-command.ts` | Changing `/review` registration, command parsing, UI notifications, scope selection, or editor write behavior. | `docs/prd/2026-05-12-native-review-mode-prd.md`, `docs/superpowers/plans/2026-05-12-native-review-mode.md` |
| Git snapshot backend | `src/review/git-review-source.ts`, `src/review/diff-parser.ts`, `src/review/types.ts` | Changing Git repo detection, base detection, dirty-tree rules, diff capture, thresholds, file status handling, hunks, rows, or anchors. | PRD sections: Command surface, Base branch detection, Comment anchor model, Large diff behavior, Testing strategy |
| Review session and server | `src/review/review-session.ts`, `src/review/review-server.ts`, `src/review/browser-review-surface.ts`, `src/review/open-browser.ts` | Changing token auth, localhost serving, drafts, heartbeat, close, submit, timeout, browser opening, or lifecycle cleanup. | PRD sections: Draft storage, Security and lifecycle, Data loading |
| Prompt generation | `src/review/review-prompt-builder.ts` | Changing generated Markdown, comment ordering, hunk snippets, or agent instructions inside submitted feedback. | PRD section: Prompt generation |
| Browser review UI | `apps/review-web/**` | Changing file tree, unified diff rendering, comment editors, saved comment cards, submit blocking, close behavior, API client, or styling. | PRD sections: Browser review UI, Comment behavior, Data loading |
| Backend tests | `test/review/**` | Adding or changing backend behavior for command parsing, Git fixtures, snapshots, parser, prompt builder, session, or server. | `CONTEXT.md` verification commands |
| Web UI tests | `apps/review-web/**/*.test.tsx` | Adding or changing UI rendering and browser interaction tests. | PRD acceptance criteria for browser UI and comment behavior |
| Product behavior | `docs/prd/**` | Clarifying user-visible scope, non-goals, acceptance criteria, or risks. | `CONTEXT.md` boundaries |
| Implementation planning | `docs/superpowers/plans/**` | Checking original task breakdown, package boundaries, or implementation constraints. | `AGENTS.md` hard constraints |

## Issue tracker

GitHub Issues are authoritative for this repo.

Issue IDs in branches, commits, and PR titles are optional. Do not invent issue IDs.

If an agent workflow says to publish to the issue tracker, create a GitHub issue only when the user explicitly asks for issue creation. Otherwise, draft the issue text and ask for confirmation.

## ADR status

There are no ADRs yet. Treat `CONTEXT.md` as the current architectural source of truth until the repo matures and explicit ADRs are added.
