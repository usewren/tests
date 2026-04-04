import { describe, it, expect } from "bun:test";

// Cross-service integration tests — assumes sandbox is running on 4001

const BASE = "http://localhost:4001";

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Origin": BASE,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function get(path: string, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    headers: {
      "Accept": "application/json",
      "Origin": BASE,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
}

describe("API integration", () => {
  it("health check passes", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("openapi spec is served", async () => {
    const res = await get("/openapi.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.info.title).toBe("Wren");
    expect(body.paths).toBeDefined();
  });

  it("docs page is served", async () => {
    const res = await fetch(`${BASE}/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
