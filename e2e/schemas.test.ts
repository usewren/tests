import { describe, it, expect } from "bun:test";
import { get, post, put, del, signUp } from "../helpers/client";

const SCHEMA = {
  type: "object",
  required: ["title"],
  properties: {
    title: { type: "string", minLength: 1 },
    published: { type: "boolean" },
  },
  additionalProperties: false,
};

describe("E2E: JSON Schema enforcement", () => {
  let cookie: string;
  let docId: string;

  it("setup: sign up", async () => { cookie = await signUp(); });

  it("no schema — accepts any JSON", async () => {
    const res = await post("/api/v1/posts", { anything: true, goes: 123 }, cookie);
    expect(res.status).toBe(201);
    docId = (await res.json() as { id: string }).id;
  });

  it("GET /_schema returns 404 when no schema set", async () => {
    const res = await get("/api/v1/posts/_schema", cookie);
    expect(res.status).toBe(404);
  });

  it("sets a JSON Schema on the collection", async () => {
    const res = await put("/api/v1/posts/_schema", SCHEMA, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { collection: string };
    expect(body.collection).toBe("posts");
  });

  it("GET /_schema returns the saved schema", async () => {
    const res = await get("/api/v1/posts/_schema", cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { schema: { required: string[] } };
    expect(body.schema.required).toContain("title");
  });

  it("valid document is accepted after schema is set", async () => {
    const res = await post("/api/v1/posts", { title: "Hello", published: true }, cookie);
    expect(res.status).toBe(201);
  });

  it("document missing required field is rejected with 422", async () => {
    const res = await post("/api/v1/posts", { published: true }, cookie);
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string; details: string[] };
    expect(body.error).toBe("Schema validation failed");
    expect(body.details.length).toBeGreaterThan(0);
  });

  it("document with extra field is rejected when additionalProperties: false", async () => {
    const res = await post("/api/v1/posts", { title: "Hi", unexpected: "field" }, cookie);
    expect(res.status).toBe(422);
  });

  it("update also validates against schema", async () => {
    const res = await put(`/api/v1/posts/${docId}`, { published: false }, cookie);
    expect(res.status).toBe(422);
  });

  it("valid update is accepted", async () => {
    const res = await put(`/api/v1/posts/${docId}`, { title: "Updated", published: false }, cookie);
    expect(res.status).toBe(200);
  });

  it("setting invalid JSON Schema returns 422", async () => {
    const res = await put("/api/v1/posts/_schema", { type: "not-a-valid-type-value-12345" }, cookie);
    expect(res.status).toBe(422);
  });

  it("deletes the schema", async () => {
    const res = await del("/api/v1/posts/_schema", cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: boolean };
    expect(body.deleted).toBe(true);
  });

  it("after schema removal, any JSON is accepted again", async () => {
    const res = await post("/api/v1/posts", { anything: "goes again" }, cookie);
    expect(res.status).toBe(201);
  });
});
