import type { ReviewCommandOptions } from "./types.js";

export class ReviewCommandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewCommandParseError";
  }
}

export function parseReviewCommand(input: string): ReviewCommandOptions {
  const tokens = tokenizeCommand(input.trim());
  if (tokens.length === 0) {
    throw new ReviewCommandParseError("Expected /review command.");
  }

  const [command, ...args] = tokens;
  if (command !== "/review") {
    throw new ReviewCommandParseError("Expected /review command.");
  }

  let base: string | undefined;
  let fixture: string | undefined;
  let agent = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--agent") {
      if (agent) {
        throw new ReviewCommandParseError("Duplicate --agent flag.");
      }
      agent = true;
      continue;
    }

    if (arg === "--base") {
      if (base !== undefined) {
        throw new ReviewCommandParseError("Duplicate --base flag.");
      }
      const branch = args[index + 1];
      if (!branch || branch.startsWith("-")) {
        throw new ReviewCommandParseError("Missing branch name after --base.");
      }
      base = branch;
      index += 1;
      continue;
    }

    if (arg === "--fixture") {
      if (fixture !== undefined) {
        throw new ReviewCommandParseError("Duplicate --fixture flag.");
      }
      const name = args[index + 1];
      if (!name || name.startsWith("-")) {
        throw new ReviewCommandParseError(
          "Missing fixture name after --fixture."
        );
      }
      fixture = name;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new ReviewCommandParseError(`Unknown review flag: ${arg}.`);
    }

    throw new ReviewCommandParseError(
      `Unexpected positional argument: ${arg}.`
    );
  }

  if (base && fixture) {
    throw new ReviewCommandParseError(
      "--fixture cannot be combined with --base."
    );
  }
  if (fixture && agent) {
    throw new ReviewCommandParseError(
      "--fixture cannot be combined with --agent."
    );
  }

  return {
    kind: "review",
    ...(base ? { base } : {}),
    ...(fixture ? { fixture } : {}),
    ...(agent ? { agent } : {})
  };
}

function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaping) {
    current += "\\";
  }
  if (quote) {
    throw new ReviewCommandParseError("Unterminated quote in /review command.");
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}
