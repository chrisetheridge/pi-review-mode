import type { DiffAnchor } from "./diff";

export type SavedCommentSource = "user" | "agent";

export interface SavedComment {
  id: string;
  anchorId: string;
  filePath: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
  source?: SavedCommentSource;
}

export interface SaveCommentRequest {
  anchor: DiffAnchor;
  body: string;
}

export interface SubmitResponse {
  prompt: string;
}
