export type ReviewScopeKind = "working-tree" | "branch";

export interface ReviewScope {
  readonly kind: ReviewScopeKind;
  readonly repoRoot: string;
  readonly label: string;
  readonly base?: string;
  readonly mergeBase?: string;
}

export interface ReviewScopeAvailability {
  readonly workingTree: AvailableReviewScope | UnavailableReviewScope;
  readonly branch: AvailableReviewScope | UnavailableReviewScope;
}

export interface AvailableReviewScope {
  readonly available: true;
  readonly scope: ReviewScope;
}

export interface UnavailableReviewScope {
  readonly available: false;
  readonly reason: string;
}
