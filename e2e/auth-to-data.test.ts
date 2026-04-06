import { describe, it, expect } from "bun:test";
import { post, get, signUp } from "../helpers/client";

describe("E2E: auth to data", () => {
  let cookie: string;
  let docId: string;

  it("registers a new user", async () => {
    cookie = await signUp();
    expect(cookie).toContain("better-auth.session_token");
  });

  it("session is valid after sign-up", async () => {
    const res = await get("/api/auth/get-session", cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string } };
    expect(body.user.email).toBeTruthy();
  });

  it("creates a document while authenticated", async () => {
    const res = await post("/api/v1/pages", { title: "E2E Page", content: "Hello" }, cookie);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; version: number };
    docId = body.id;
    expect(docId).toBeTruthy();
    expect(body.version).toBe(1);
  });

  it("reads the document back", async () => {
    const res = await get(`/api/v1/pages/${docId}`, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { title: string } };
    expect(body.data.title).toBe("E2E Page");
  });

  it("signs out", async () => {
    const res = await post("/api/auth/sign-out", {}, cookie);
    expect(res.status).toBe(200);
  });

  it("cannot access document after sign out", async () => {
    const res = await get(`/api/v1/pages/${docId}`, cookie);
    expect(res.status).toBe(401);
  });
});
