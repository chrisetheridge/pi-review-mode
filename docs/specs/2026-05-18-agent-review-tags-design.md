# Agent pre-review tags

## Status

Approved for implementation planning.

## Parent decision

This spec extends ADR 0003, visible agent pre-review for review mode. It keeps the same architecture: the extension asks the active Pi agent to review a frozen Git snapshot, the agent submits structured comments through `submit_review_mode_comments`, the extension validates anchors, and the browser opens with seeded drafts for user curation.

No new architectural decision is required because tags stay within the existing agent pre-review and browser curation flow. Tags do not change snapshot ownership, Git input rules, review session lifecycle, or final prompt submission semantics.

## Summary

Agent pre-review comments may include optional tags. Tags help the user scan and filter agent comments before submitting curated feedback.

Supported tags for v1:

- `spec`
- `standards`
- `bug`

Tags apply only to agent pre-review comments. User-authored comments remain untagged. Agent comments may have zero, one, or several tags.

## Goals

- Let the pre-review agent classify comments along a small fixed set of review axes.
- Let the browser highlight tagged agent comments.
- Let the user filter saved comments by tag with OR semantics.
- Keep existing agent tool calls without tags valid.
- Keep the final submitted prompt focused on curated feedback, without source or tag labels.

## Non-goals

- Tags for user-authored comments.
- Arbitrary agent-defined tags.
- Custom tag configuration.
- Persisted review history or analytics.
- Grouping the final prompt by tag.
- Changing the frozen snapshot or anchor model.

## Tag semantics

### `spec`

Use `spec` only when the comment is grounded in an identifiable requirement.

Before using `spec`, the pre-review agent should try to infer the applicable requirement from available project context, such as:

- repository docs
- issue text visible in the conversation or working context
- PRDs and files under `docs/specs/**`
- README behavior
- tests
- code comments that define expected behavior

If the agent cannot infer a relevant requirement, it must not use `spec`. The agent must not invent product requirements to justify the tag.

### `standards`

Use `standards` for comments about project conventions, codebase architecture, style, maintainability, boundaries, naming, or testing expectations.

### `bug`

Use `bug` for comments that identify likely incorrect behavior, runtime failures, broken edge cases, data loss, security issues, or test failures.

## Structured tool contract

Extend `submit_review_mode_comments` comment input with optional `tags`:

```ts
{
  reviewId: string;
  comments: Array<{
    anchorId: string;
    body: string;
    tags?: Array<"spec" | "standards" | "bug">;
  }>;
}
```

Validation rules:

- `tags` is optional.
- Missing `tags`, `undefined`, and an empty array all mean no tags.
- Each tag must be one of `spec`, `standards`, or `bug`.
- Unknown tags reject the tool call so the agent can retry.
- Duplicate tags on one comment are collapsed.
- Existing validation still applies: matching `reviewId`, valid anchor, non-empty body, comment count cap, and body length cap.
- Duplicate anchor IDs still collapse to one accepted comment per anchor. The last submitted comment for an anchor wins and keeps its normalized tags.

## Backend model

Add a shared tag type near the agent review and draft model:

```ts
type AgentReviewTag = "spec" | "standards" | "bug";
```

Extend submitted agent comments, seed drafts, review drafts, and browser saved comments with optional tags:

```ts
interface SubmittedAgentReviewComment {
  anchorId: string;
  body: string;
  tags?: AgentReviewTag[];
}

interface ReviewDraft {
  anchor: ReviewAnchor;
  body: string;
  updatedAt: string;
  source?: "user" | "agent";
  tags?: AgentReviewTag[];
}
```

Rules:

- Agent-seeded drafts keep normalized tags.
- User-created comments have no tags.
- Editing an agent-seeded draft preserves its existing `source` and `tags`.
- The draft list API returns `tags` to the browser.
- Final prompt generation ignores `tags` and `source`.

## Agent pre-review prompt

Update `buildAgentReviewPrompt(snapshot, reviewId)` to include a review axes section.

Prompt requirements:

- List the valid tags: `spec`, `standards`, `bug`.
- State that tags are optional.
- State that a comment may include multiple tags.
- State that the agent must omit tags rather than invent new categories.
- Add the `spec` inference rule:
  - Try to infer relevant requirements from available docs, issue context, specs, README behavior, tests, or code comments.
  - Use `spec` only when grounded in an identifiable requirement.
  - Do not use `spec` when no relevant requirement can be inferred.
  - Do not invent requirements.
- Update the JSON example to include optional tags:

```json
{
  "reviewId": "...",
  "comments": [
    {
      "anchorId": "...",
      "body": "...",
      "tags": ["spec", "bug"]
    }
  ]
}
```

## Browser UI

Saved agent comments show:

- the existing `Agent` badge when `source === "agent"`
- one tag badge for each tag on the comment

Show a tag filter control only when at least one saved comment has tags. The filter control supports `spec`, `standards`, and `bug`.

Filtering rules:

- With no selected tag filters, show all saved comments.
- With one or more selected tag filters, show comments that include any selected tag.
- Untagged comments are hidden while any tag filter is active.
- Filtering affects saved comment cards only.
- Diff files, hunks, rows, file headers, comment buttons, and anchors remain visible.
- Clearing selected filters restores all comments.

## Transport normalization

The browser transport normalizer accepts missing tags and treats them as no tags, matching the existing optional-field model style.

Rules:

- Preserve valid tags returned by the backend.
- Drop invalid tag values in the browser normalizer. Backend validation owns trusted input, so invalid display data should not break rendering.
- Existing payloads without tags continue to render.

## Final prompt behavior

`buildReviewPrompt(snapshot, drafts)` remains source-neutral and tag-neutral.

The final prompt represents user-curated feedback. It must not include `Agent`, `spec`, `standards`, or `bug` labels unless the user wrote those words in the comment body.

## Compatibility

Existing pre-review agents that call `submit_review_mode_comments` without `tags` continue to work.

Existing browser sessions without tagged drafts render unchanged.

No Git snapshot schema change is needed. Tags belong to submitted comments and drafts, not anchors or diff rows.

## Test plan

Backend tests:

- `AgentReviewCoordinator` accepts comments without tags.
- `AgentReviewCoordinator` accepts comments with one valid tag.
- `AgentReviewCoordinator` accepts comments with multiple valid tags.
- `AgentReviewCoordinator` rejects unknown tags.
- `AgentReviewCoordinator` deduplicates repeated tags.
- Duplicate anchor submission keeps normalized tags on the last submitted comment for that anchor.
- `agentCommentsToSeedDrafts` preserves tags.
- `InProcessReviewSession.saveDraft` preserves tags when editing an agent-seeded draft.
- `buildAgentReviewPrompt` documents valid tags, optional multi-tag behavior, and the spec inference rule.
- `buildReviewPrompt` omits tags and source labels.

Browser tests:

- Transport normalization preserves valid tags.
- Transport normalization handles missing tags.
- `SavedCommentCard` renders tag badges for tagged comments.
- Tag filter is hidden when no comments have tags.
- Tag filter appears when at least one saved comment has tags.
- Selecting one tag shows comments containing that tag and hides untagged comments.
- Selecting multiple tags uses OR semantics.
- Clearing filters restores all comments.

Manual smoke:

```sh
pnpm build
pi -e ./
/review --agent
```

Confirm:

- The visible agent pre-review prompt includes tag guidance.
- Agent comments can arrive with zero, one, or multiple tags.
- The browser shows tag badges on tagged agent comments.
- Tag filtering uses OR semantics.
- Editing an agent comment keeps its tags.
- Final submit writes a prompt without tag or source labels.
