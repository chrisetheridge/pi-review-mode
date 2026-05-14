import { describe, expect, it } from "vitest";
import {
  parseReviewCommand,
  ReviewCommandParseError
} from "../../src/review/command/parse.js";

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

  it("parses /review --agent", () => {
    expect(parseReviewCommand("/review --agent")).toEqual({
      kind: "review",
      agent: true
    });
  });

  it("parses /review --agent --base <branch>", () => {
    expect(parseReviewCommand("/review --agent --base feature/main")).toEqual({
      kind: "review",
      agent: true,
      base: "feature/main"
    });
  });

  it("parses /review --fixture <name>", () => {
    expect(parseReviewCommand("/review --fixture basic")).toEqual({
      kind: "review",
      fixture: "basic"
    });
  });

  it("rejects combining --fixture with --base", () => {
    expect(() =>
      parseReviewCommand("/review --fixture basic --base main")
    ).toThrow("--fixture cannot be combined with --base");
  });

  it("rejects combining --fixture with --agent", () => {
    expect(() => parseReviewCommand("/review --fixture basic --agent")).toThrow(
      "--fixture cannot be combined with --agent"
    );
  });

  it("rejects missing fixture names", () => {
    expect(() => parseReviewCommand("/review --fixture")).toThrow(
      "Missing fixture name after --fixture"
    );
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
