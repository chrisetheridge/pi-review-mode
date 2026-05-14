---
name: pi-review-release
description: Release checklist for pi-review-mode. Use when preparing, checking, versioning, or publishing a pi-review-mode npm release, especially when updating CHANGELOG.md, moving Unreleased entries, running npm publish, or validating packaged web assets.
---

# Pi Review Release

Use this skill only in the `pi-review-mode` repository.

## Normal development on main

When making changes on `main` or preparing changes that will land on `main`:

1. For every user-visible change, add a short entry to `CHANGELOG.md` under `## [Unreleased]`.
2. Put the entry under the right category: `Added`, `Changed`, or `Fixed`.
3. Keep entries user-focused. Mention behavior, packaging, docs, or release-impacting changes; avoid noisy internal implementation details unless they affect users or maintainers.
4. Commit changelog updates with the related change when practical.
5. Treat `Unreleased` as: committed or merged changes that are not published to npm yet.

Do not move entries out of `Unreleased` during normal development. Move them only when preparing a specific release version.

## Required changelog handling

Before any release version bump or npm publish:

1. Open `CHANGELOG.md`.
2. Move all completed user-visible entries from `## [Unreleased]` into a new version section:
   - Format: `## [x.y.z] - YYYY-MM-DD`
   - Use the exact version that will be published.
   - Use the current local date.
3. Keep `## [Unreleased]` at the top with empty category headings ready for the next cycle.
4. Do not publish if release-worthy changes exist only under `Unreleased`.
5. Commit the changelog update before running `pnpm version ...`; `pnpm version` expects a clean working tree.

Minimal shape:

```md
## [Unreleased]

### Added

### Changed

### Fixed

## [x.y.z] - YYYY-MM-DD

### Added

- ...
```

If there are no entries for a category in the released section, remove that empty category from the released section. Keep empty categories only under `Unreleased`.

## Release checklist

Use this checklist when cutting and publishing a release:

- [ ] Confirm `CHANGELOG.md` has all user-visible changes under `## [Unreleased]`.
- [ ] Choose the next SemVer version: patch, minor, or major.
- [ ] Move `Unreleased` entries into `## [x.y.z] - YYYY-MM-DD`.
- [ ] Leave a fresh empty `Unreleased` section at the top.
- [ ] Remove empty categories from the released version section.
- [ ] Commit the changelog update.
- [ ] Run `pnpm release:check` and inspect `npm pack --dry-run` output.
- [ ] Run `pnpm release:patch`, `pnpm release:minor`, or `pnpm release:major`.
- [ ] Confirm `package.json`, `CHANGELOG.md`, and git tag use the same version.
- [ ] Run `npm publish`.
- [ ] Push the release commit and tag with `git push` and `git push --tags`.
- [ ] Smoke test the published package with `pi -e npm:pi-review-mode@x.y.z`.

## Pre-release verification

Run:

```sh
pnpm release:check
```

This must complete successfully before versioning or publishing. Confirm `npm pack --dry-run` includes:

```text
dist/extension/**
dist/review-web/**
README.md
RELEASE.md
CHANGELOG.md
CONTEXT.md
package.json
```

The web UI assets must be local under `dist/review-web`; do not rely on CDN runtime assets.

## Version bump

After changelog is updated and committed, choose the SemVer level:

```sh
pnpm release:patch
pnpm release:minor
pnpm release:major
```

These commands run checks, update `package.json`, create the version commit, and create the git tag.

## npm publish

Before publishing:

1. Confirm `CHANGELOG.md` has a section for the exact package version.
2. Confirm no completed release notes remain under `Unreleased`.
3. Confirm the version in `package.json` matches the changelog section and git tag.
4. Confirm `pnpm release:check` passed for the final tree.

Publish:

```sh
npm login
npm publish
```

For scoped public packages:

```sh
npm publish --access public
```

After publishing:

```sh
git push
git push --tags
```

Smoke test the published package:

```sh
pi -e npm:pi-review-mode@x.y.z
```
