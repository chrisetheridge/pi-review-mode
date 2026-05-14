# ADR 0003: Visible agent pre-review for review mode

## Status

Approved

## Context

Review mode currently opens a browser UI for a frozen Git diff and lets the user write comments manually. Users also want an optional way to ask the active Pi agent to review the same changes first, then curate those agent-suggested comments in the browser before submitting feedback.

The browser review UI already supports the needed curation behavior: comments are anchored to snapshot anchors, stored as server-side drafts, editable, deletable, and submitted as a final prompt. The missing piece is how agent feedback enters that draft store safely.

The extension must stay outside Pi core, use public Pi extension APIs, keep Git as the source of truth for review input, and preserve the frozen snapshot boundary. The browser must not inspect or mutate the working tree.

## Decision

Add an opt-in agent pre-review mode:

```text
/review --agent
/review --agent --base <branch>
```

The existing `/review` behavior remains unchanged.

For `/review --agent`, the extension will:

1. Create the normal frozen Git snapshot.
2. Show Pi's native/default working spinner while the pre-review is running.
3. Send a visible user message to the active Pi agent asking it to review the snapshot.
4. Provide the agent with an anchor catalog containing exact valid `anchorId` values for file and diff-line anchors.
5. Allow the agent to inspect current files with tools for context, while instructing it not to edit files.
6. Require the agent to submit structured comments through an extension tool named `submit_review_mode_comments`.
7. Validate submitted anchors against the frozen snapshot.
8. Seed the browser review session with valid agent comments.
9. Open the normal browser diff view.

If the agent returns no comments, fails, times out, or does not call the tool, the extension will still open the normal browser diff view with no seeded comments. Snapshot creation errors still block review mode as they do today.

Agent comments are stored as normal review drafts with browser-only provenance:

```ts
source?: "user" | "agent";
```

The browser shows an `Agent` badge for `source: "agent"`. Users can edit or delete those comments. Editing keeps the original source. Source labels are not included in the final generated prompt because the user has curated the comments before submit.

Range feedback uses the existing single-anchor model. The agent anchors the comment to the most relevant line and mentions the range in the comment body.

## Consequences

Users can request agent feedback before writing their own review comments, while still controlling what feedback is submitted.

The main conversation will visibly contain the agent pre-review turn. This is acceptable for the first version and avoids hidden process/model orchestration.

The extension avoids parsing natural-language assistant output. Structured tool submission gives deterministic validation and clear failure behavior.

The browser UI remains mostly unchanged because agent feedback enters as normal saved drafts.

The command may take longer before the browser opens. The native Pi working spinner/message should make that waiting state explicit.

Only one pending agent pre-review should exist at a time in the extension runtime. Concurrent `/review --agent` attempts should fail clearly.

## Alternatives considered

### Parse assistant prose

The extension could ask the agent to return Markdown or JSON in its assistant message and parse that response. This is brittle, makes anchor errors harder to recover from, and creates worse failure modes when the model returns partially valid output.

### Hidden nested RPC agent

The extension could spawn a nested `pi --mode rpc --no-session` process and keep pre-review out of the main conversation. This would add process lifecycle, model/auth, cancellation, and error-handling complexity. It can be revisited later if visible pre-review is too noisy.

### Browser-triggered agent review button

The browser could offer a button that starts agent review after the diff view opens. That matches a possible future interaction, but it requires browser-to-extension orchestration while an active review session is already running. Pre-review before browser launch is simpler for v1.

### Range anchors

The agent could submit start/end anchors for multi-line comments. Current review mode stores one draft per anchor and renders comments at a single file or line position. Adding range anchors would require model, validation, UI, and prompt-generation changes. V1 keeps single anchors and expresses range intent in comment text.

## Test plan

Cover:

- `/review --agent` command parsing.
- `/review --agent --base <branch>` command parsing.
- Agent review prompt includes anchor IDs and tool instructions.
- `submit_review_mode_comments` accepts valid anchors and rejects unknown anchors.
- Duplicate anchors collapse to one draft per anchor.
- Agent drafts are seeded into `ReviewSession` with `source: "agent"`.
- Browser draft API preserves `source`.
- Saved comment cards show an `Agent` badge only in the browser.
- Editing an agent comment keeps `source: "agent"`.
- Final prompt generation omits source labels.
- Agent failure, timeout, empty comment list, or missing tool call still opens the diff view with no seeded comments.

Run:

```sh
pnpm check
pnpm build
```

Manual smoke:

```sh
pnpm build
pi -e ./
/review --agent
```

Confirm the native Pi working spinner/message appears during pre-review, the agent turn is visible, and the browser opens afterward with editable/deletable seeded comments when the agent provides any.
