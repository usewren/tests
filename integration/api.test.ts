import { describe, it, expect } from "bun:test";
import { get, BASE } from "../helpers/client";

describe("API integration", () => {
  it("health check passes", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("openapi spec is served", async () => {
    const res = await get("/openapi.json");
    expect(res.status).toBe(200);
    const body = await res.json() as { info: { title: string }; paths: object };
    expect(body.info.title).toBe("Wren");
    expect(body.paths).toBeDefined();
  });

  it("docs page is served", async () => {
    const res = await fetch(`${BASE}/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("marketing site is served at root", async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("admin UI is served", async () => {
    const res = await fetch(`${BASE}/admin`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("unauthenticated data request returns 401", async () => {
    const res = await get("/api/v1/anything");
    expect(res.status).toBe(401);
  });
});
