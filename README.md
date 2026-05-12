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
pi -e ./src/index.ts
```

For a built package, run `pnpm build` first so the extension can serve `dist/review-web` without a dev server.

## Installation

For project-local use, place or symlink this package under the project’s `.pi/extensions` directory if your Pi setup loads project extensions from there. If distributed as a package, install it with your normal package manager and point Pi at the package extension entry.

The package entry is declared in `package.json`:

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

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

Close/cancel behavior:

1. Start `/review`.
2. Close the browser UI or press the Close button.
3. Confirm the Pi editor contents are unchanged.
