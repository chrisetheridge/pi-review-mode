import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface ReviewModeConfig {
  readonly agentReview: boolean;
}

const DEFAULT_CONFIG: ReviewModeConfig = {
  agentReview: true
};

export function loadReviewModeConfig(): ReviewModeConfig {
  const configPath = join(getAgentDir(), "extensions", "pi-review-mode.json");
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as unknown;
  if (!isRecord(parsed)) {
    return DEFAULT_CONFIG;
  }

  const agentReview = parsed["agent-review"];
  return {
    agentReview:
      typeof agentReview === "boolean"
        ? agentReview
        : DEFAULT_CONFIG.agentReview
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
