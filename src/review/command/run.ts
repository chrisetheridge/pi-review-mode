import type {
  PiCommandContext,
  PiCommandHandlerArgs,
  PiExtensionHost
} from "../../pi-extension.types.js";
import {
  type AgentReviewCoordinator,
  agentCommentsToSeedDrafts
} from "../agent/coordinator.js";
import { loadReviewModeConfig } from "../config.js";
import { buildAgentReviewPrompt } from "../prompt/agent.js";
import type { ReviewSnapshot } from "../snapshot/types.js";
import { FixtureReviewSource } from "../source/fixture.js";
import { GitReviewSource } from "../source/git.js";
import type { ReviewScope } from "../source/scope.types.js";
import { openGlimpseReviewSurface } from "../surface/glimpse.js";
import { parseReviewCommand } from "./parse.js";

interface RunReviewCommandOptions {
  args: PiCommandHandlerArgs;
  ctx: PiCommandContext;
  pi: PiExtensionHost;
  agentReviews: AgentReviewCoordinator;
}

export async function runReviewCommand({
  args,
  ctx,
  pi,
  agentReviews
}: RunReviewCommandOptions) {
  try {
    const options = parseReviewCommand(commandInput(args));

    if (!ctx.hasUI) {
      await ctx.ui?.notify?.(
        "Review mode requires an interactive Pi UI.",
        "error"
      );
      return;
    }

    const snapshot = options.fixture
      ? new FixtureReviewSource(ctx.cwd ?? process.cwd()).createSnapshot(
          assertFixtureModeEnabled(options.fixture)
        )
      : await createGitSnapshot(options.base, ctx);

    if (!snapshot) {
      await ctx.ui?.notify?.(
        "Review cancelled. Editor contents were not changed.",
        "info"
      );
      return;
    }
    const config = loadReviewModeConfig();
    const shouldRunAgentReview =
      options.agent || (!options.fixture && config.agentReview);
    const seedDrafts = shouldRunAgentReview
      ? await collectAgentPreReview(snapshot, agentReviews, pi, ctx)
      : [];

    await ctx.ui?.notify?.(
      "Opening native review window for a frozen Git snapshot.",
      "info"
    );
    const result = await openGlimpseReviewSurface(snapshot, {
      seedDrafts,
      onSubmitPrompt: async (prompt) => {
        await ctx.ui?.setEditorText?.(prompt);
        await ctx.ui?.notify?.(
          "Review feedback was written into the editor.",
          "success"
        );
      }
    });

    if (result.prompt) {
      return;
    }

    await ctx.ui?.notify?.(
      "Review closed. Editor contents were not changed.",
      "info"
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start review mode.";
    await ctx.ui?.notify?.(message, "error");
  }
}

function commandInput(args: PiCommandHandlerArgs): string {
  if (typeof args === "string") {
    return args.startsWith("/review") ? args : `/review ${args}`.trim();
  }

  if (args.input) {
    return args.input.startsWith("/review")
      ? args.input
      : `/review ${args.input}`.trim();
  }

  return `/review ${(args.args ?? []).join(" ")}`.trim();
}

function assertFixtureModeEnabled(fixture: string): string {
  if (process.env.PI_REVIEW_MODE_FIXTURES !== "1") {
    throw new Error(
      "Review fixtures are development-only. Set PI_REVIEW_MODE_FIXTURES=1 to use /review --fixture."
    );
  }
  return fixture;
}

async function collectAgentPreReview(
  snapshot: ReviewSnapshot,
  agentReviews: AgentReviewCoordinator,
  pi: PiExtensionHost,
  ctx: PiCommandContext
) {
  const pending = agentReviews.start(snapshot);
  const prompt = buildAgentReviewPrompt(snapshot, pending.reviewId);
  ctx.ui?.setWorkingMessage?.("Running review pre-check...");

  try {
    if (!pi.sendMessage || !ctx.waitForIdle) {
      await ctx.ui?.notify?.(
        "Agent pre-review is unavailable in this Pi runtime. Opening the review window with no seeded comments.",
        "warning"
      );
      return [];
    }

    pi.sendMessage(
      {
        customType: "review-mode-agent-prereview",
        content: prompt,
        display: false,
        details: { reviewId: pending.reviewId }
      },
      { triggerTurn: true, deliverAs: "followUp" }
    );

    const comments = await Promise.race([
      pending.submitted,
      ctx.waitForIdle().then(() => pending.comments()),
      delayUntil(pending.expiresAt).then(() => pending.comments())
    ]);

    if (comments.length === 0) {
      await ctx.ui?.notify?.(
        "Agent pre-review returned no comments. Opening the review window.",
        "warning"
      );
    } else {
      await ctx.ui?.notify?.(
        `Agent pre-review seeded ${comments.length} comment${comments.length === 1 ? "" : "s"}.`,
        "info"
      );
    }

    return agentCommentsToSeedDrafts(comments);
  } catch (error) {
    await ctx.ui?.notify?.(
      `Agent pre-review failed: ${error instanceof Error ? error.message : "Unknown error"}. Opening the review window with no seeded comments.`,
      "warning"
    );
    return [];
  } finally {
    ctx.ui?.setWorkingMessage?.();
    agentReviews.cancel();
  }
}

function delayUntil(timestamp: number): Promise<void> {
  const delayMs = Math.max(0, timestamp - Date.now());
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, delayMs);
    timeout.unref?.();
  });
}

async function createGitSnapshot(
  base: string | undefined,
  ctx: PiCommandContext
) {
  const source = new GitReviewSource(ctx.cwd ?? process.cwd());
  const scope = base
    ? source.createBranchScope(base)
    : await selectReviewScope(source, ctx);
  return scope ? source.createSnapshot(scope) : undefined;
}

async function selectReviewScope(
  source: GitReviewSource,
  ctx: PiCommandContext
): Promise<ReviewScope | undefined> {
  const availability = source.getAvailability();
  const options: ReviewScope[] = [];
  const unavailable: string[] = [];

  if (availability.workingTree.available) {
    options.push(availability.workingTree.scope);
  } else {
    unavailable.push(`Working tree: ${availability.workingTree.reason}`);
  }

  if (availability.branch.available) {
    options.push(availability.branch.scope);
  } else {
    unavailable.push(`Branch: ${availability.branch.reason}`);
  }

  if (options.length === 0) {
    throw new Error(unavailable.join("\n"));
  }

  if (unavailable.length > 0) {
    await ctx.ui?.notify?.(unavailable.join("\n"), "warning");
  }

  if (options.length === 1) {
    return options[0];
  }

  const selectedLabel = await ctx.ui?.select?.(
    "Choose changes to review",
    options.map((option) => option.label)
  );
  return options.find((option) => option.label === selectedLabel);
}
