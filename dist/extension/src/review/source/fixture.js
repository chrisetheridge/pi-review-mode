import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseReviewDiff } from "../snapshot/parse-diff.js";
import { buildReviewWarnings, calculateReviewStats, enforceReviewThresholds, ReviewSizeError } from "./size.js";
export class FixtureReviewSourceError extends Error {
    constructor(message) {
        super(message);
        this.name = "FixtureReviewSourceError";
    }
}
export class FixtureReviewSource {
    repoRoot;
    fixturesDir;
    constructor(repoRoot) {
        this.repoRoot = repoRoot;
        this.fixturesDir = join(repoRoot, "fixtures", "review");
    }
    createSnapshot(name) {
        const fixtureName = validateFixtureName(name);
        const path = join(this.fixturesDir, `${fixtureName}.diff`);
        if (!existsSync(path)) {
            throw new FixtureReviewSourceError(`Unknown review fixture '${fixtureName}'. ${this.availableFixturesMessage()}`);
        }
        const diff = readFileSync(path, "utf8");
        if (!diff.trim()) {
            throw new FixtureReviewSourceError(`Review fixture '${fixtureName}' is empty.`);
        }
        const files = parseReviewDiff(diff);
        if (files.length === 0) {
            throw new FixtureReviewSourceError(`Fixture diff did not contain reviewable files: ${fixtureName}.`);
        }
        const stats = calculateReviewStats(files);
        try {
            enforceReviewThresholds(stats);
        }
        catch (error) {
            if (error instanceof ReviewSizeError) {
                throw new FixtureReviewSourceError(error.message);
            }
            throw error;
        }
        return {
            id: createHash("sha256")
                .update(`fixture\0${fixtureName}\0${diff}`)
                .digest("hex")
                .slice(0, 24),
            createdAt: new Date().toISOString(),
            repoRoot: this.repoRoot,
            scope: {
                kind: "working-tree",
                repoRoot: this.repoRoot,
                label: `Fixture: ${fixtureName}`
            },
            baseRef: "fixture-base",
            headRef: "fixture-head",
            diff,
            files,
            stats,
            warnings: buildReviewWarnings(stats)
        };
    }
    availableFixtures() {
        if (!existsSync(this.fixturesDir))
            return [];
        return readdirSync(this.fixturesDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith(".diff"))
            .map((entry) => entry.name.slice(0, -".diff".length))
            .filter((name) => isSafeFixtureBasename(name))
            .sort((a, b) => a.localeCompare(b));
    }
    availableFixturesMessage() {
        const fixtures = this.availableFixtures();
        if (fixtures.length === 0)
            return "No fixtures are available.";
        return `Available fixtures: ${fixtures.join(", ")}.`;
    }
}
function validateFixtureName(name) {
    if (name.endsWith(".diff")) {
        throw new FixtureReviewSourceError("Do not include the .diff extension in review fixture names.");
    }
    if (!isSafeFixtureBasename(name)) {
        throw new FixtureReviewSourceError("Fixture names must be safe basenames without '/', '\\', or '..'.");
    }
    return name;
}
function isSafeFixtureBasename(name) {
    return (name.length > 0 &&
        !name.includes("/") &&
        !name.includes("\\") &&
        !name.includes(".."));
}
