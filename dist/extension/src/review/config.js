import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
const DEFAULT_CONFIG = {
    agentReview: true
};
export function loadReviewModeConfig() {
    const configPath = join(getAgentDir(), "extensions", "pi-review-mode.json");
    if (!existsSync(configPath)) {
        return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
    if (!isRecord(parsed)) {
        return DEFAULT_CONFIG;
    }
    const agentReview = parsed["agent-review"];
    return {
        agentReview: typeof agentReview === "boolean"
            ? agentReview
            : DEFAULT_CONFIG.agentReview
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
