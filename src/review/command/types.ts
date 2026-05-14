export interface ReviewCommandOptions {
  readonly kind: "review";
  readonly base?: string;
  readonly fixture?: string;
  readonly agent?: boolean;
}
