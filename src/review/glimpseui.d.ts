declare module "glimpseui" {
  import type { EventEmitter } from "node:events";

  export interface GlimpseOpenOptions {
    readonly width?: number;
    readonly height?: number;
    readonly title?: string;
    readonly x?: number;
    readonly y?: number;
    readonly frameless?: boolean;
    readonly floating?: boolean;
    readonly transparent?: boolean;
    readonly clickThrough?: boolean;
    readonly noDock?: boolean;
    readonly hidden?: boolean;
    readonly autoClose?: boolean;
    readonly openLinks?: boolean;
    readonly openLinksApp?: string;
    readonly followCursor?: boolean;
    readonly cursorOffset?: { readonly x?: number; readonly y?: number };
    readonly cursorAnchor?: string;
    readonly followMode?: string;
  }

  export interface GlimpseWindow extends EventEmitter {
    send(js: string): void;
    setHTML(html: string): void;
    loadFile(path: string): void;
    show(options?: { readonly title?: string }): void;
    close(): void;
    on(event: "message", listener: (data: unknown) => void): this;
    on(event: "closed", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    once(event: "message", listener: (data: unknown) => void): this;
    once(event: "closed", listener: () => void): this;
    once(event: "error", listener: (error: Error) => void): this;
    removeListener(event: "message", listener: (data: unknown) => void): this;
    removeListener(event: "closed", listener: () => void): this;
    removeListener(event: "error", listener: (error: Error) => void): this;
  }

  export function open(
    html: string,
    options?: GlimpseOpenOptions
  ): GlimpseWindow;
}
