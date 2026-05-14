# Agent pre-review for review mode

## Status

Approved for implementation planning.

## Summary

Add an opt-in `/review --agent` mode. It creates the same frozen Git diff snapshot as `/review`, asks the active Pi agent to visibly review that snapshot, seeds the browser review session with any structured agent comments, then opens the normal browser diff review UI. If the agent review fails or returns no comments, the browser still opens the diff view with no seeded comments.

The existing `/review` flow remains unchanged.

## Command surface

Supported forms:

```text
/review --agent
/review --agent --base <branch>
```

Rules:

- `/review` stays fast/manual and opens the browser directly.
- `/review --base <branch>` keeps current branch-review behavior.
- `/review --agent` runs agent pre-review before opening the browser.
- `/review --agent --base <branch>` runs agent pre-review against the explicit branch snapshot.

## User flow

1. User runs `/review --agent`.
2. Extension computes the frozen snapshot using the current Git source rules.
3. Extension shows Pi's native/default working spinner while the agent review is running.
   - Use native Pi working UI, e.g. set a working message such as `Running review pre-check...` and restore the default spinner afterward.
   - Do not implement a custom spinner in the browser for this phase, because the browser has not opened yet.
4. Extension sends a visible user message to the active Pi agent.
5. Agent may inspect current files with tools for context.
6. Agent must not edit files during pre-review.
7. Agent returns comments by calling the structured extension tool `submit_review_mode_comments`.
8. Extension validates and normalizes comments.
9. Extension opens the normal browser diff view:
   - with seeded agent comments when available
   - with no seeded comments when the agent returns none, fails, times out, or does not call the tool
10. User edits/deletes agent comments and adds their own comments.
11. Submit writes the curated final prompt into the Pi editor.

## Agent prompt

Add `buildAgentReviewPrompt(snapshot)` to produce the visible agent request.

The prompt includes:

- scope metadata
- frozen snapshot warning
- instruction to inspect current files if helpful
- instruction not to edit files
- an anchor catalog containing all valid file and diff-line anchors from the snapshot
- instruction to use exact `anchorId` values from the catalog
- instruction to call `submit_review_mode_comments`
- guidance that range feedback should be anchored to one relevant line and mention the range in the body

Valid agent comment targets are anything inside the frozen diff:

- file-level anchors
- added lines
- deleted lines
- context lines visible in hunks

The agent must not invent anchors or comment on arbitrary lines outside the snapshot.

## Structured tool

Register an extension tool:

```text
submit_review_mode_comments
```

Input shape:

```ts
{
  reviewId: string;
  comments: Array<{
    anchorId: string;
    body: string;
  }>;
}
```

Validation rules:

- `reviewId` must match the currently pending agent pre-review.
- `anchorId` must resolve against the frozen snapshot.
- `body` must be non-empty after trimming.
- Unknown anchors are rejected.
- Duplicate anchor IDs collapse to one draft per anchor, matching existing draft semantics.
- Cap comment count and body length to protect the session. Suggested defaults: 50 comments and 4,000 characters per body.

Tool output reports the number of accepted comments.

## Pending pre-review coordinator

Keep pending agent pre-review state in the extension runtime.

Conceptual shape:

```ts
interface PendingAgentReview {
  reviewId: string;
  snapshot: ReviewSnapshot;
  resolve(comments: AgentReviewComment[]): void;
  reject(error: Error): void;
  expiresAt: number;
}
```

Rules:

- Only one pending agent pre-review may exist at a time.
- If another `/review --agent` starts while one is pending, fail clearly.
- The command waits for tool submission, agent end without submission, cancellation, or timeout.
- On failure/timeout/no tool call, notify the user and continue by opening the diff view with no seeded comments.

## Draft model

Extend saved review drafts with browser-only provenance:

```ts
interface ReviewDraft {
  anchor: ReviewAnchor;
  body: string;
  updatedAt: string;
  source?: "user" | "agent";
}
```

Rules:

- Browser-created comments default to `source: "user"`.
- Agent pre-review comments are seeded as `source: "agent"`.
- Editing an agent-seeded comment keeps `source: "agent"`.
- Source is returned by draft APIs.
- Source is not included in the final generated prompt.

## Browser UI

- Render a small `Agent` badge on saved comment cards where `source === "agent"`.
- Agent comments are otherwise normal saved drafts.
- Agent comments can be edited/deleted.
- Agent comments count toward submit eligibility.
- Browser does not need an agent-review loading state in v1 because pre-review happens before launch.

## Failure behavior

For `/review --agent`, always open the browser diff view after snapshot creation unless snapshot creation itself fails.

Cases:

- Agent submits comments: seed them, notify count, open browser.
- Agent submits empty list: notify no comments, open browser empty.
- Agent fails/times out/does not call tool: warn, open browser empty.
- Tool receives invalid payload: reject the tool call so the agent can retry before timeout.

"Open browser empty" means the normal diff view opens with no seeded comments, not an empty page.

## Final prompt behavior

The final submitted prompt remains a curated user review prompt. It does not label comments by source, because the user had a chance to edit/delete every comment before submit.

## Non-goals for v1

- Hidden nested RPC agent review.
- Parsing assistant prose for comments.
- Multi-line/range anchor schema.
- Browser-triggered agent review button.
- Agent edits during pre-review.
- Persisting agent-review history after review session lifecycle ends.

## Test plan

Backend:

- parse `/review --agent`
- parse `/review --agent --base <branch>`
- reject invalid flag combinations consistently with current parser rules
- build agent review prompt with anchor IDs
- validate submitted tool comments against known anchors
- reject unknown anchors
- seed `ReviewSession` with agent drafts
- keep source on draft edit
- final prompt omits source labels
- timeout/no-tool path opens browser with no seeded comments

Browser:

- draft API normalizes `source`
- `SavedCommentCard` shows `Agent` badge for agent comments
- editing/deleting agent comments works
- submit eligibility counts agent comments

Manual smoke:

```sh
pnpm build
pi -e ./
/review --agent
```

Confirm:

- native Pi working spinner/message appears while agent review runs
- agent review turn is visible in the conversation
- browser opens afterward
- seeded comments are editable/deletable
- final submit writes curated prompt to editor without source labels
