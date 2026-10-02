import { describe, expect, test } from "bun:test";
import { isPublicRoute } from "@/auth/routing";

describe("authentication routing", () => {
  test("only Clerk entry routes and the development icon gallery are public", () => {
    expect(isPublicRoute("/sign-in")).toBe(true);
    expect(isPublicRoute("/sign-in/factor-one")).toBe(true);
    expect(isPublicRoute("/sign-up")).toBe(true);
    expect(isPublicRoute("/icon-gallery")).toBe(process.env.NODE_ENV !== "production");
    expect(isPublicRoute("/")).toBe(false);
    expect(isPublicRoute("/api/documents")).toBe(false);
    expect(isPublicRoute("/sign-injected")).toBe(false);
  });
});
