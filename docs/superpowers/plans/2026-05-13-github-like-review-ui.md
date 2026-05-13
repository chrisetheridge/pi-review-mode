# GitHub-like Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the browser review UI use a light GitHub-like diff review chrome as its primary style.

**Architecture:** Preserve the existing React state model, review API, frozen snapshot behavior, and `@git-diff-view/react` renderer. Implement the refresh through component styling, a path-tree sidebar renderer, and CSS overrides for the diff renderer.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Vitest, Testing Library, `@git-diff-view/react`.

---

## File structure

- Move: `docs/superpowers/specs/2026-05-13-github-like-review-ui-design.md` to `docs/adrs/0002-github-like-review-ui.md` and wrap it as an approved ADR.
- Modify: `apps/review-web/src/App.tsx` to default to light mode and replace branded chrome with compact review tooling chrome.
- Modify: `apps/review-web/src/components/FileTree.tsx` to render a filterable folder tree from changed paths.
- Modify: `apps/review-web/src/components/FileDiff.tsx` to use flat file panels and compact file actions.
- Modify: `apps/review-web/src/styles.css` to add GitHub-like diff-renderer overrides.
- Modify: `apps/review-web/tailwind.config.ts` to tune light tokens as the primary palette.
- Modify tests under `apps/review-web/src/**/*.test.tsx` to verify behavior remains intact and the new tree/filter/default-light behavior exists.

## Task 1: ADR move

- [x] Rename the design spec to `docs/adrs/0002-github-like-review-ui.md`.
- [x] Add ADR header sections: title, Status Approved, Context, Decision, Consequences, Test plan.
- [x] Verify `git status --short` shows a rename/delete-add pair for the doc.

## Task 2: Sidebar tree behavior, TDD

- [x] Add a failing test in `apps/review-web/src/components/FileTree.test.tsx` proving folder rows render for nested paths and the filter hides non-matching files.
- [x] Run `pnpm test -- --run apps/review-web/src/components/FileTree.test.tsx`; expected failure because folder rows/filter are missing.
- [x] Implement a path tree in `FileTree.tsx` with a `Filter files...` input, folder rows, file rows, status badges, stats, comment badges, selection, and collapse toggles.
- [x] Run `pnpm test -- --run apps/review-web/src/components/FileTree.test.tsx`; expected pass.

## Task 3: App chrome/default light behavior, TDD

- [x] Update `apps/review-web/src/App.test.tsx` so the shell test expects the compact review chrome and a default light shell when local storage is empty.
- [x] Run `pnpm test -- --run apps/review-web/src/App.test.tsx`; expected failure on old branding/default-dark assumptions.
- [x] Update `App.tsx` so light is the default theme, the sidebar has no Pi branding/nav block, the header is compact, and submit/close/theme controls remain accessible.
- [x] Run `pnpm test -- --run apps/review-web/src/App.test.tsx`; expected pass.

## Task 4: File diff chrome and renderer colors, TDD

- [x] Add assertions in `apps/review-web/src/components/FileDiff.test.tsx` for the compact file stats/action labels that should remain accessible.
- [x] Run `pnpm test -- --run apps/review-web/src/components/FileDiff.test.tsx`; expected failure before label/header updates if needed.
- [x] Update `FileDiff.tsx` for flat bordered panels, compact file header, quieter file comment action, and GitHub-like stat styling.
- [x] Add CSS overrides in `styles.css` for pale hunk, add, delete, gutter, widget, and extension-row treatment.
- [x] Run `pnpm test -- --run apps/review-web/src/components/FileDiff.test.tsx`; expected pass.

## Task 5: Full verification and commit

- [x] Run `pnpm test -- --run apps/review-web`.
- [x] Run `pnpm check`.
- [x] Run `pnpm build`.
- [x] Inspect `git diff` for accidental generated files or behavior changes.
- [x] Commit the implementation with a concise conventional commit message.
