import { vi } from "vitest";

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => ({
    font: "",
    measureText: (text: string) => ({ width: text.length * 8 })
  }))
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock
});

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: vi.fn(() => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 24,
    width: 800,
    height: 24,
    toJSON: () => undefined
  }))
});
