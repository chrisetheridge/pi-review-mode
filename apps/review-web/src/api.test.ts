import { describe, expect, it } from "vitest";
import { readApiBaseUrlFromLocation } from "./api";

describe("readApiBaseUrlFromLocation", () => {
  it("reads the API base URL from the review page query string", () => {
    const location = new URL(
      "http://127.0.0.1:5173/?token=test&apiBaseUrl=http%3A%2F%2F127.0.0.1%3A4321"
    ) as unknown as Location;

    expect(readApiBaseUrlFromLocation(location)).toBe("http://127.0.0.1:4321");
  });
});
