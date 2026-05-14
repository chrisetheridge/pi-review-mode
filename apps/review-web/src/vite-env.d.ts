/// <reference types="vite/client" />

interface Window {
  glimpse?: {
    send(message: unknown): void;
    close?(): void;
  };
  __PI_REVIEW_RECEIVE__?: (message: unknown) => void;
}
