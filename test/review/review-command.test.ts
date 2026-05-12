import { describe, expect, it } from "vitest";
import {
  parseReviewCommand,
  ReviewCommandParseError
} from "../../src/review/review-command.js";

describe("parseReviewCommand", () => {
  it("parses bare /review", () => {
    expect(parseReviewCommand("/review")).toEqual({ kind: "review" });
  });

  it("parses /review --base <branch>", () => {
    expect(parseReviewCommand("/review --base feature/main")).toEqual({
      kind: "review",
      base: "feature/main"
    });
  });

  it("supports quoted branch names", () => {
    expect(parseReviewCommand('/review --base "branch with spaces"')).toEqual({
      kind: "review",
      base: "branch with spaces"
    });
  });

  it("rejects unknown flags", () => {
    expect(() => parseReviewCommand("/review --target main")).toThrow(
      ReviewCommandParseError
    );
  });

  it("rejects missing branch after --base", () => {
    expect(() => parseReviewCommand("/review --base")).toThrow(
      "Missing branch name after --base"
    );
  });

  it("rejects positional args", () => {
    expect(() => parseReviewCommand("/review main")).toThrow(
      "Unexpected positional argument"
    );
  });
});
