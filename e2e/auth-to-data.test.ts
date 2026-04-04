import { describe, it, expect } from "bun:test";

// E2E: sign up → create data → read it back → sign out → verify locked out

const BASE = "http://localhost:4001";
const email = `e2e+${Date.now()}@wren.dev`;
let cookie: string;
let docId: string;

async function post(path: string, body: unknown, c?: string) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "Origin": BASE, ...(c ? { Cookie: c } : {}) },
    body: JSON.stringify(body),
  });
}

async function get(path: string, c?: string) {
  return fetch(`${BASE}${path}`, {
    headers: { "Accept": "application/json", "Origin": BASE, ...(c ? { Cookie: c } : {}) },
  });
}

describe("E2E: auth to data", () => {
  it("registers a new user", async () => {
    const res = await post("/api/auth/sign-up/email", { email, password: "secret123", name: "E2E User" });
    expect(res.status).toBe(200);
    cookie = decodeURIComponent(res.headers.get("set-cookie")?.split(";")[0] ?? "");
    expect(cookie).toContain("better-auth.session_token");
  });

  it("creates a document while authenticated", async () => {
    const res = await post("/pages", { title: "E2E Page", content: "Hello" }, cookie);
    expect(res.status).toBe(201);
    const body = await res.json();
    docId = body.id;
    expect(docId).toBeTruthy();
  });

  it("reads the document back", async () => {
    const res = await get(`/pages/${docId}`, cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("E2E Page");
  });

  it("signs out", async () => {
    const res = await post("/api/auth/sign-out", {}, cookie);
    expect(res.status).toBe(200);
  });

  it("cannot access document after sign out", async () => {
    const res = await get(`/pages/${docId}`, cookie);
    expect(res.status).toBe(401);
  });
});
