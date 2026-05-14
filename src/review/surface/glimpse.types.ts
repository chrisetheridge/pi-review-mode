import type { SeedReviewDraftInput } from "../session/in-process.js";

export interface GlimpseWindowLike {
  send(js: string): void;
  loadFile(path: string): void;
  close(): void;
  on(event: "message", listener: (data: unknown) => void): this;
  on(event: "closed", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  removeListener(event: "message", listener: (data: unknown) => void): this;
  removeListener(event: "closed", listener: () => void): this;
  removeListener(event: "error", listener: (error: Error) => void): this;
}

export interface GlimpseReviewSurfaceOptions {
  readonly assetsDir?: string;
  readonly seedDrafts?: readonly SeedReviewDraftInput[];
  readonly openWindow?: (
    html: string,
    options: {
      readonly width: number;
      readonly height: number;
      readonly title: string;
    }
  ) => GlimpseWindowLike;
  readonly onSubmitPrompt?: (prompt: string) => Promise<void> | void;
}

export interface GlimpseReviewSurfaceResult {
  readonly prompt?: string;
  readonly closed: boolean;
}
