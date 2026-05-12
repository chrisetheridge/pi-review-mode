import { openBrowserReviewSurface } from "./review/browser-review-surface.js";
import { GitReviewSource } from "./review/git-review-source.js";
import { parseReviewCommand } from "./review/review-command.js";
import type { ReviewScope } from "./review/types.js";

type PiCommandContext = {
  cwd?: string;
  hasUI?: boolean;
  ui?: {
    notify?: (
      message: string,
      kind?: "info" | "success" | "warning" | "error"
    ) => Promise<void> | void;
    select?: <T>(
      message: string,
      options: Array<{ label: string; value: T; description?: string }>
    ) => Promise<T | undefined>;
    setEditorText?: (text: string) => Promise<void> | void;
  };
};

type PiCommandHandlerArgs = string | { input?: string; args?: string[] };

type PiExtensionHost = {
  registerCommand: (
    name: string,
    command: {
      description: string;
      handler: (
        args: PiCommandHandlerArgs,
        ctx: PiCommandContext
      ) => Promise<void>;
    }
  ) => void;
};

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

export default function reviewModeExtension(pi: PiExtensionHost) {
  pi.registerCommand("review", {
    description: "Open a browser UI for commenting on a frozen Git diff.",
    async handler(args, ctx) {
      try {
        const options = parseReviewCommand(commandInput(args));

        if (!ctx.hasUI) {
          await ctx.ui?.notify?.(
            "Browser review requires an interactive Pi UI.",
            "error"
          );
          return;
        }

        const source = new GitReviewSource(ctx.cwd ?? process.cwd());
        const scope = options.base
          ? source.createBranchScope(options.base)
          : await selectReviewScope(source, ctx);

        if (!scope) {
          await ctx.ui?.notify?.(
            "Review cancelled. Editor contents were not changed.",
            "info"
          );
          return;
        }

        const snapshot = source.createSnapshot(scope);
        await ctx.ui?.notify?.(
          "Opening browser review for a frozen Git snapshot.",
          "info"
        );
        const result = await openBrowserReviewSurface(snapshot);

        if (result.prompt) {
          await ctx.ui?.setEditorText?.(result.prompt);
          await ctx.ui?.notify?.(
            "Review feedback was written into the editor.",
            "success"
          );
          return;
        }

        await ctx.ui?.notify?.(
          "Review closed. Editor contents were not changed.",
          "info"
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to start review mode.";
        await ctx.ui?.notify?.(message, "error");
      }
    }
  });
}

async function selectReviewScope(
  source: GitReviewSource,
  ctx: PiCommandContext
): Promise<ReviewScope | undefined> {
  const availability = source.getAvailability();
  const options: Array<{
    label: string;
    value: ReviewScope;
    description?: string;
  }> = [];
  const unavailable: string[] = [];

  if (availability.workingTree.available) {
    options.push({
      label: availability.workingTree.scope.label,
      value: availability.workingTree.scope,
      description:
        "Review staged, unstaged, and untracked changes against HEAD."
    });
  } else {
    unavailable.push(`Working tree: ${availability.workingTree.reason}`);
  }

  if (availability.branch.available) {
    options.push({
      label: availability.branch.scope.label,
      value: availability.branch.scope,
      description:
        "Review committed branch changes from the merge-base to HEAD."
    });
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
    return options[0].value;
  }

  return ctx.ui?.select?.("Choose changes to review", options);
}
