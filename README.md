# Pi Review Mode

Pi Review Mode is a Pi extension package that adds `/review`. It opens a tokenized localhost browser UI for commenting on a frozen Git diff, then writes the submitted review prompt back into the active Pi editor with `ctx.ui.setEditorText`.

The extension does not modify Pi core and does not touch `packages/coding-agent/*`.

## Development

Install and verify with pnpm:

```sh
pnpm install
pnpm typecheck
pnpm test -- --run
pnpm build
pnpm biome:check
```

Run locally in Pi from this repository:

```sh
pnpm build
pi -e ./
```

Run a repeatable development-only fixture review without editing files:

```sh
PI_REVIEW_MODE_FIXTURES=1 pi -e ./
```

Then run `/review --fixture basic` or `/review --fixture mixed`. Fixture mode is blocked unless `PI_REVIEW_MODE_FIXTURES=1` is set.

The package manifest points Pi at the built extension entry in `dist/extension`, and the extension serves the bundled browser UI from `dist/review-web`.

## Installation

Install from a local checkout:

```sh
pnpm build
pi install ./
```

Try it for one Pi run without installing:

```sh
pnpm build
pi -e ./
```

Install from npm after publishing:

```sh
pi install npm:pi-review-mode
```

Install from git:

```sh
pi install git:github.com/<owner>/pi-review-mode
```

The package entry is declared in `package.json` and loads the built extension:

```json
{
  "pi": {
    "extensions": ["./dist/extension/src/index.js"]
  }
}
```

## Distribution

Build and inspect the npm tarball before publishing:

```sh
pnpm install
pnpm build
npm pack --dry-run
```

Publish with npm when the tarball includes `dist/extension/**` and `dist/review-web/**`:

```sh
npm publish
```

The `prepare` script runs the build, so `npm pack`, `npm publish`, and Pi git installs rebuild both the extension and browser assets. Runtime browser assets are bundled locally; no CDN assets are required.

## Manual Smoke Tests

Working-tree review:

1. Edit a tracked file and create one untracked file.
2. Run `/review`.
3. Choose working-tree changes.
4. Add at least one file or line comment in the browser.
5. Submit and confirm the generated Markdown appears in the Pi editor but is not sent automatically.

Branch review:

1. Commit local changes on a feature branch.
2. Ensure the working tree is clean.
3. Run `/review`.
4. Choose the branch-vs-base option.
5. Submit feedback and confirm the editor is updated.

Explicit base review:

```text
/review --base main
```

Fixture review:

1. Run `PI_REVIEW_MODE_FIXTURES=1 pi -e ./`.
2. Run `/review --fixture basic`.
3. Add at least one comment in the browser.
4. Submit and confirm the generated Markdown appears in the Pi editor.
5. Unset `PI_REVIEW_MODE_FIXTURES` and confirm `/review --fixture basic` reports that fixtures are development-only.

Close/cancel behavior:

1. Start `/review`.
2. Close the browser UI or press the Close button.
3. Confirm the Pi editor contents are unchanged.
