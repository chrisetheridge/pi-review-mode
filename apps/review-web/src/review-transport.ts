import type {
  ReviewSnapshot,
  SaveCommentRequest,
  SavedComment,
  SubmitResponse
} from "./types";

export class ReviewTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewTransportError";
  }
}

export interface ReviewTransport {
  load(): Promise<{ snapshot: ReviewSnapshot; drafts: SavedComment[] }>;
  saveDraft(draft: SaveCommentRequest): Promise<SavedComment>;
  deleteDraft(anchorId: string): Promise<void>;
  close(): Promise<void>;
  submit(): Promise<SubmitResponse>;
}
