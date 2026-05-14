# Release Process

This package is published to npm as a Pi extension package. The npm tarball must include both the compiled extension and the bundled review web assets.

## Versioning

Use SemVer:

- `patch`: bug fixes, docs, internal changes
- `minor`: new compatible `/review` behavior or UI features
- `major`: breaking install/runtime behavior

## Changelog

Keep release notes in `CHANGELOG.md`. Before cutting a release:

1. Move entries from `Unreleased` to the new version.
2. Use an ISO date, for example `## [0.1.1] - 2026-05-14`.
3. Summarize user-visible changes and notable fixes.
4. Commit the changelog update before running a version command. `pnpm version` expects a clean working tree.

## Pre-release check

Run:

```sh
pnpm release:check
```

This runs:

```sh
pnpm check
pnpm build
npm pack --dry-run
```

In the dry-run output, confirm the package contains at least:

```text
dist/extension/**
dist/review-web/**
README.md
CONTEXT.md
package.json
```

The web UI must be bundled under `dist/review-web`; runtime assets must be local and not loaded from a CDN.

## Bump the version

Choose one:

```sh
pnpm release:patch
pnpm release:minor
pnpm release:major
```

These commands run the release check first, then call `pnpm version <level>` to update `package.json`, create the version commit, and create the git tag.

If you need to edit the changelog as part of the release, do that before running the version command and commit it first.

## Publish

Log in if needed:

```sh
npm login
```

Publish:

```sh
npm publish
```

For a scoped public package, use:

```sh
npm publish --access public
```

Then push the release commit and tag:

```sh
git push
git push --tags
```

## Smoke test the published package

Replace the version with the one just published:

```sh
pi -e npm:pi-review-mode@0.1.1
```

Or install it:

```sh
pi install npm:pi-review-mode@0.1.1
```
