import { describe, it, expect } from "vitest";
import { app } from "@/server/index";

describe("Hono Server Endpoints", () => {
  it("GET /api/health responds with 200 and db: true", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.db).toBe(true);
  });

  it("POST /api/auth/login validates body", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/bootstrap returns 401 unauthenticated", async () => {
    const res = await app.request("/api/bootstrap");
    expect(res.status).toBe(401);
  });
});
