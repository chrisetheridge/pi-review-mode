# Agent Pre-Review Tags Spec

## Goal

Add optional fixed tags to agent pre-review comments so users can scan and filter agent-suggested feedback before submitting curated review feedback.

Tags are metadata for browser curation only. They do not change Git snapshot ownership, comment anchoring, review session lifecycle, or final prompt semantics.

## Background

ADR 0003 introduced visible agent pre-review for review mode. In that flow, the extension creates a frozen Git snapshot, asks the active Pi agent to review that snapshot, accepts structured comments through `submit_review_mode_comments`, validates anchors, seeds the browser review session with saved drafts, and lets the user curate those drafts before final submission.

The current pre-review flow has one browser provenance signal: `source?: "user" | "agent"`. This allows the browser to show an `Agent` badge, but it does not help users distinguish requirement issues, standards issues, and likely bugs when several agent comments are seeded.

Relevant constraints:

- Review mode remains a Pi extension, not Pi core.
- Git and the frozen snapshot remain the source of truth for review input.
- The browser reads only the frozen snapshot and in-memory drafts.
- Submitted feedback is written into the Pi editor and is not sent automatically.
- Runtime browser assets remain bundled locally.

## Decisions

- Decision: Agent comments may include optional tags from a small fixed set: `spec`, `standards`, and `bug`.
- Source: This spec; extends ADR 0003.
- Consequence: Agents can classify feedback without introducing arbitrary categories or configuration.

- Decision: Tags apply only to agent pre-review comments.
- Source: ADR 0003 provenance model and this spec.
- Consequence: User-authored comments remain untagged unless the user writes tag words in the body.

- Decision: Unknown tags reject the agent tool call; duplicate tags on one comment are collapsed.
- Source: Structured tool contract in this spec.
- Consequence: The trusted backend model stays normalized while allowing the agent to retry invalid tool calls.

- Decision: Browser transport normalization drops invalid tag values.
- Source: Existing browser optional-field normalization style.
- Consequence: Invalid display data cannot break rendering, while backend validation remains authoritative for trusted input.

- Decision: Final generated prompts ignore `source` and `tags`.
- Source: ADR 0003 final prompt behavior.
- Consequence: Submitted feedback remains user-curated and source-neutral.

## Scope

### In

- Optional agent review tags on `submit_review_mode_comments` input.
- Backend validation and normalization of tag metadata.
- Preservation of normalized tags through agent comments, seed drafts, review drafts, and browser saved comments.
- Agent pre-review prompt guidance for valid tags and tag semantics.
- Browser display of tag badges on saved agent comments.
- Browser filtering of saved comment cards by selected tags with OR semantics.
- Tests for backend validation, prompt guidance, transport normalization, UI badges, filtering, and final prompt neutrality.

### Out

- Tags for user-authored comments.
- Arbitrary or configurable tag names.
- Persisted review history, analytics, or tag telemetry.
- Grouping or sorting the final generated prompt by tag.
- Changing the frozen snapshot schema, anchor model, Git input rules, or diff row data.
- Range comments, threaded comments, search, syntax highlighting, or direct browser editing of files.
- Hidden agent orchestration or nested agent processes.

## Current Architecture

`src/index.ts` registers the `submit_review_mode_comments` tool and the `/review` command.

When agent pre-review runs, `src/review/command/run.ts` creates a frozen snapshot and calls `buildAgentReviewPrompt(snapshot, reviewId)`. The active Pi agent receives a visible pre-review message containing an anchor catalog. The agent submits structured comments through the extension tool.

`src/review/agent/coordinator.ts` owns pending agent pre-review state. It validates `reviewId`, comment count, anchors, non-empty bodies, and body length. It collapses duplicate anchor submissions so the last submitted comment for an anchor wins. `agentCommentsToSeedDrafts` converts accepted comments into seed drafts with `source: "agent"`.

`src/review/session/in-process.ts` owns in-memory saved drafts for the active review window. Seeded drafts and user edits are stored as `ReviewDraft` objects. Editing an existing agent-seeded draft preserves `source: "agent"`.

The Glimpse review surface returns drafts to the browser. The browser transport normalizers in `apps/review-web/src/review/transport/normalize.ts` map backend draft payloads into `SavedComment` objects. `SavedCommentCard` renders the saved comment body and the existing `Agent` badge. `App` groups saved comments by file and passes them to file diff components.

`src/review/prompt/build.ts` builds the final Markdown prompt from saved drafts. It treats drafts as curated feedback and does not include draft provenance.

## Target Architecture

Tags are draft metadata owned by the agent pre-review and draft pipeline, not by the frozen snapshot.

The extension exposes the same `submit_review_mode_comments` tool with an optional `tags` field per submitted comment. The coordinator validates and normalizes tags before storing accepted comments. Seeded review drafts carry those normalized tags into the in-process review session.

The browser saved comment model accepts optional tags. Saved agent comments render the existing `Agent` badge plus one badge per tag. The top-level app derives a saved-comment tag filter only when at least one saved comment has tags. Filtering affects rendered saved comment cards only; files, hunks, rows, file headers, comment buttons, anchors, and active editors remain visible.

Final prompt generation remains source-neutral and tag-neutral. Tags are curation aids, not instructions sent to the next agent unless the user writes those words in the comment body.

## Contracts

### [ADDED] Agent review tag type

```ts
type AgentReviewTag = "spec" | "standards" | "bug";
```

Tag semantics:

- `spec`: Feedback grounded in an identifiable requirement. The agent should infer requirements from available docs, issue context, PRDs, files under `docs/specs/**`, README behavior, tests, or code comments. The agent must not invent product requirements to justify this tag.
- `standards`: Feedback about project conventions, codebase architecture, style, maintainability, boundaries, naming, or testing expectations.
- `bug`: Feedback identifying likely incorrect behavior, runtime failures, broken edge cases, data loss, security issues, or test failures.

### [CHANGED] `submit_review_mode_comments` input

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
- Missing `tags`, `undefined`, and `[]` mean no tags.
- Every tag must be `spec`, `standards`, or `bug`.
- Unknown tags reject the tool call.
- Duplicate tags on one comment collapse to the first occurrence order.
- Existing validation still applies: matching `reviewId`, valid anchor, non-empty body, comment count cap, and body length cap.
- Duplicate anchor IDs still collapse to one accepted comment per anchor. The last submitted comment for an anchor wins and keeps its normalized tags.

### [CHANGED] Backend agent comment and draft model

```ts
interface SubmittedAgentReviewComment {
  anchorId: string;
  body: string;
  tags?: readonly AgentReviewTag[];
}

interface SeedReviewDraft {
  anchorId: string;
  body: string;
  source: "agent";
  tags?: readonly AgentReviewTag[];
}

interface ReviewDraft {
  anchor: ReviewAnchor;
  body: string;
  updatedAt: string;
  source?: "user" | "agent";
  tags?: readonly AgentReviewTag[];
}
```

Rules:

- Agent-seeded drafts keep normalized tags.
- User-created comments have no tags by default.
- Editing an agent-seeded draft preserves existing `source` and `tags`.
- Draft listing returns tags to the browser.

### [CHANGED] Agent pre-review prompt

`buildAgentReviewPrompt(snapshot, reviewId)` must include tag guidance:

- Valid tags are `spec`, `standards`, and `bug`.
- Tags are optional.
- A comment may include multiple tags, one tag, or no tags.
- The agent must omit tags rather than invent new categories.
- `spec` requires an identifiable requirement and must not be invented.
- The JSON example includes optional `tags`.

Example shape:

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

### [CHANGED] Browser saved comment model

```ts
interface SavedComment {
  id: string;
  anchorId: string;
  filePath: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
  source?: "user" | "agent";
  tags?: AgentReviewTag[];
}
```

Browser normalization rules:

- Missing tags normalize to no tags.
- Valid tags from backend payloads are preserved.
- Invalid tag values are dropped.
- Duplicate valid tag values are collapsed.
- Existing payloads without tags continue to render.

### [ADDED] Browser tag display and filtering

Saved comment cards render:

- `Agent` badge when `source === "agent"`.
- One tag badge for each tag on the comment.

The tag filter control:

- Appears only when at least one saved comment has tags.
- Supports `spec`, `standards`, and `bug`.
- With no selected filters, shows all saved comments.
- With selected filters, shows saved comments that contain any selected tag.
- Hides untagged saved comments while any filter is active.
- Does not hide files, hunks, rows, file headers, comment buttons, anchors, or active editors.
- Clearing filters restores all saved comments.

### [UNCHANGED] Final prompt contract

`buildReviewPrompt(snapshot, drafts)` remains source-neutral and tag-neutral.

The generated prompt must not include `Agent`, `spec`, `standards`, or `bug` labels unless those words appear in the user-visible comment body.

## Migration Plan

No persisted data migration is required. Review sessions are in-memory and short-lived.

### Phase 1: Backend tag contract

- Change: Add the fixed tag type, extend the tool schema and backend comment/draft types, validate tags in the agent review coordinator, and preserve normalized tags through seed drafts and draft edits.
- Compatibility: Existing tool calls without `tags` remain valid.
- Acceptance criteria: Agent comments with missing tags, one valid tag, multiple valid tags, duplicate tags, and unknown tags are covered by backend tests.

### Phase 2: Prompt guidance

- Change: Update the agent pre-review prompt to explain tag semantics, optional multi-tag behavior, and the `spec` grounding rule.
- Compatibility: Agents may still submit comments without tags.
- Acceptance criteria: Prompt tests verify valid tags, optional tag behavior, multi-tag example, and the requirement not to invent `spec` grounds.

### Phase 3: Browser curation

- Change: Extend browser saved comment normalization and rendering to carry tags, display badges, and filter saved comment cards by OR semantics.
- Compatibility: Browser sessions without tagged drafts render unchanged.
- Acceptance criteria: Browser tests cover missing tags, valid tag preservation, invalid tag dropping, badge rendering, hidden filter when no tags exist, visible filter when tags exist, single-tag filtering, multi-tag OR filtering, and clearing filters.

### Phase 4: Prompt neutrality verification

- Change: Ensure final prompt generation ignores `source` and `tags`.
- Compatibility: Existing prompt shape remains stable except for user-authored body text.
- Acceptance criteria: Prompt tests verify source and tag labels are omitted from generated review feedback.

## Deletion Criteria

No old persistent schema, adapter, or feature flag is introduced.

Compatibility behavior for missing `tags` must remain because agents and browser sessions may omit optional fields indefinitely. It is not scheduled for deletion.

## Acceptance Criteria

- [ ] `submit_review_mode_comments` accepts comments with no `tags` field.
- [ ] `submit_review_mode_comments` accepts one or more valid tags from `spec`, `standards`, and `bug`.
- [ ] `submit_review_mode_comments` rejects unknown tags.
- [ ] Duplicate tags on one comment are collapsed.
- [ ] Duplicate anchor submissions keep the normalized tags from the last accepted comment for that anchor.
- [ ] Agent-seeded drafts preserve tags.
- [ ] Editing an agent-seeded draft preserves its `source` and `tags`.
- [ ] Browser transport preserves valid tags and drops invalid tag values.
- [ ] Saved agent comments show the `Agent` badge and tag badges.
- [ ] The tag filter is hidden when no saved comment has tags.
- [ ] Selecting one tag shows comments with that tag and hides untagged comments.
- [ ] Selecting multiple tags uses OR semantics.
- [ ] Clearing filters restores all saved comments.
- [ ] Filtering affects saved comment cards only; diff structure and comment anchors remain visible.
- [ ] Final generated prompts omit source and tag labels unless present in comment bodies.

## Testing Strategy

Backend tests should cover the agent coordinator, seed draft conversion, in-process session editing, agent prompt builder, and final prompt builder.

Browser tests should cover transport normalization, saved comment card badges, and app-level tag filtering behavior.

Manual smoke should run a local extension session:

```sh
pnpm build
pi -e ./
/review --agent
```

Confirm that the visible agent pre-review prompt includes tag guidance, tagged agent comments render with badges, OR filtering works, editing an agent comment keeps tags, and final submit writes a prompt without tag or source labels.

## Open Questions

None.
