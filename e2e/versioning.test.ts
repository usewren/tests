import { describe, it, expect } from "bun:test";
import { get, post, put, signUp } from "../helpers/client";

describe("E2E: versioning", () => {
  let cookie: string;
  let docId: string;

  it("setup: sign up", async () => { cookie = await signUp(); });

  it("creates a document at v1", async () => {
    const res = await post("/api/v1/articles", { title: "First", body: "Hello" }, cookie);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; version: number };
    docId = body.id;
    expect(body.version).toBe(1);
  });

  it("updating creates v2", async () => {
    const res = await put(`/api/v1/articles/${docId}`, { title: "Second", body: "World" }, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(2);
  });

  it("updating again creates v3", async () => {
    const res = await put(`/api/v1/articles/${docId}`, { title: "Third", body: "!" }, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { version: number };
    expect(body.version).toBe(3);
  });

  it("lists all three versions", async () => {
    const res = await get(`/api/v1/articles/${docId}/versions`, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { versions: { version: number }[] };
    expect(body.versions).toHaveLength(3);
    expect(body.versions.map((v) => v.version)).toEqual([1, 2, 3]);
  });

  it("fetches data at a specific version", async () => {
    const res = await get(`/api/v1/articles/${docId}/versions/1`, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { version: number; data: { title: string } };
    expect(body.version).toBe(1);
    expect(body.data.title).toBe("First");
  });

  it("diffs v1 and v2", async () => {
    const res = await get(`/api/v1/articles/${docId}/diff?v1=1&v2=2`, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { diff: { op: string; path: string }[] };
    expect(body.diff.length).toBeGreaterThan(0);
    const paths = body.diff.map((d) => d.path);
    expect(paths).toContain("/title");
    expect(paths).toContain("/body");
  });

  it("rollback to v1 creates v4", async () => {
    const res = await post(`/api/v1/articles/${docId}/rollback/1`, {}, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { version: number; rolledBackTo: number };
    expect(body.version).toBe(4);
    expect(body.rolledBackTo).toBe(1);
  });

  it("current data matches v1 after rollback", async () => {
    const res = await get(`/api/v1/articles/${docId}`, cookie);
    const body = await res.json() as { version: number; data: { title: string } };
    expect(body.version).toBe(4);
    expect(body.data.title).toBe("First");
  });

  describe("labels", () => {
    it("sets a label on the current version", async () => {
      const res = await post(`/api/v1/articles/${docId}/labels`, { label: "published" }, cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { label: string; version: number };
      expect(body.label).toBe("published");
      expect(body.version).toBe(4);
    });

    it("sets a label on a specific older version", async () => {
      const res = await post(`/api/v1/articles/${docId}/labels`, { label: "archive", version: 2 }, cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { label: string; version: number };
      expect(body.label).toBe("archive");
      expect(body.version).toBe(2);
    });

    it("fetches the published version by label", async () => {
      const res = await get(`/api/v1/articles/${docId}?label=published`, cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { title: string } };
      expect(body.data.title).toBe("First");
    });

    it("fetches the archive version by label", async () => {
      const res = await get(`/api/v1/articles/${docId}?label=archive`, cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { title: string } };
      expect(body.data.title).toBe("Second");
    });
  });
});
