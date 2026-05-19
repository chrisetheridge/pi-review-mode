import type { DiffAnchor } from "./diff";

export type AgentReviewTag = "spec" | "standards" | "bug";

export type SavedCommentSource = "user" | "agent";

export interface SavedComment {
  id: string;
  anchorId: string;
  filePath: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
  source?: SavedCommentSource;
  tags?: AgentReviewTag[];
}

export interface SaveCommentRequest {
  anchor: DiffAnchor;
  body: string;
}

export interface SubmitResponse {
  prompt: string;
}
