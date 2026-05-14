import { Type } from "typebox";
import type { PiExtensionHost } from "./pi-extension.types.js";
import { AgentReviewCoordinator } from "./review/agent/coordinator.js";
import { runReviewCommand } from "./review/command/run.js";

export default function reviewModeExtension(pi: PiExtensionHost) {
  const agentReviews = new AgentReviewCoordinator();

  pi.registerTool?.({
    name: "submit_review_mode_comments",
    label: "Submit review-mode comments",
    description:
      "Submit structured comments for a pending /review --agent pre-review. Use only when review mode asks for it.",
    promptSnippet:
      "submit_review_mode_comments: submit structured comments for a pending /review --agent pre-review.",
    parameters: Type.Object({
      reviewId: Type.String(),
      comments: Type.Array(
        Type.Object({
          anchorId: Type.String(),
          body: Type.String()
        })
      )
    }),
    async execute(_toolCallId, params) {
      const result = agentReviews.submit(params);
      return {
        content: [
          {
            type: "text",
            text: `Accepted ${result.accepted} review comment${result.accepted === 1 ? "" : "s"}.`
          }
        ],
        details: result
      };
    }
  });

  pi.registerCommand("review", {
    description:
      "Open a native review window for commenting on a frozen Git diff.",
    async handler(args, ctx) {
      await runReviewCommand({ args, ctx, pi, agentReviews });
    }
  });
}
