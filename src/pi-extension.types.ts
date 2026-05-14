export type PiCommandContext = {
  cwd?: string;
  hasUI?: boolean;
  ui?: {
    notify?: (
      message: string,
      kind?: "info" | "success" | "warning" | "error"
    ) => Promise<void> | void;
    select?: (
      message: string,
      options: string[]
    ) => Promise<string | undefined>;
    setEditorText?: (text: string) => Promise<void> | void;
    setWorkingMessage?: (message?: string) => void;
  };
  waitForIdle?: () => Promise<void>;
};

export type PiCommandHandlerArgs = string | { input?: string; args?: string[] };

export type PiExtensionHost = {
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
  sendMessage?: (
    message: {
      customType: string;
      content: string;
      display: boolean;
      details?: unknown;
    },
    options?: {
      triggerTurn?: boolean;
      deliverAs?: "steer" | "followUp" | "nextTurn";
    }
  ) => void;
  registerTool?: (tool: {
    name: string;
    label: string;
    description: string;
    promptSnippet?: string;
    parameters: unknown;
    execute: (
      toolCallId: string,
      params: {
        reviewId: string;
        comments: Array<{ anchorId: string; body: string }>;
      }
    ) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      details: unknown;
    }>;
  }) => void;
};
