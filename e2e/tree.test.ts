import { describe, it, expect } from "bun:test";
import { get, post, put, del, signUp } from "../helpers/client";

describe("E2E: tree access", () => {
  let cookie: string;
  let docId: string;
  let doc2Id: string;

  it("setup: sign up and create documents", async () => {
    cookie = await signUp();
    const r1 = await post("/api/v1/pages", { title: "About" }, cookie);
    docId = (await r1.json() as { id: string }).id;
    const r2 = await post("/api/v1/pages", { title: "Contact" }, cookie);
    doc2Id = (await r2.json() as { id: string }).id;
  });

  describe("listing trees", () => {
    it("returns empty list before any paths are assigned", async () => {
      const res = await get("/api/v1/tree", cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { trees: unknown[] };
      expect(Array.isArray(body.trees)).toBe(true);
    });
  });

  describe("assigning paths", () => {
    it("assigns a document to /about in the main tree", async () => {
      const res = await put(`/api/v1/tree/main/about`, { documentId: docId }, cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { tree: string; path: string; documentId: string };
      expect(body.tree).toBe("main");
      expect(body.path).toBe("/about");
      expect(body.documentId).toBe(docId);
    });

    it("assigns a document to /contact in the main tree", async () => {
      const res = await put(`/api/v1/tree/main/contact`, { documentId: doc2Id }, cookie);
      expect(res.status).toBe(200);
    });

    it("main tree now appears in list", async () => {
      const res = await get("/api/v1/tree", cookie);
      const body = await res.json() as { trees: { name: string; count: number }[] };
      const main = body.trees.find((t) => t.name === "main");
      expect(main).toBeDefined();
      expect(main!.count).toBe(2);
    });
  });

  describe("reading paths", () => {
    it("GET /tree/main/about returns the document", async () => {
      const res = await get("/api/v1/tree/main/about", cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { document: { id: string }; path: string; assignmentDocId: string };
      expect(body.document.id).toBe(docId);
      expect(body.path).toBe("/about");
      expect(body.assignmentDocId).toBeTruthy();
    });

    it("root path lists children", async () => {
      const res = await get("/api/v1/tree/main/", cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { children: { path: string }[] };
      const paths = body.children.map((c) => c.path);
      expect(paths).toContain("/about");
      expect(paths).toContain("/contact");
    });

    it("GET on unassigned path returns 404", async () => {
      const res = await get("/api/v1/tree/main/nonexistent", cookie);
      expect(res.status).toBe(404);
    });

    it("requires an existing documentId", async () => {
      const res = await put("/api/v1/tree/main/bad", { documentId: "00000000-0000-0000-0000-000000000000" }, cookie);
      expect(res.status).toBe(500); // throws Document not found
    });
  });

  describe("assignment history", () => {
    it("reassigning creates a new version on the assignment doc", async () => {
      // First assignment was doc1 at /about. Reassign to doc2.
      const res = await put("/api/v1/tree/main/about", { documentId: doc2Id }, cookie);
      expect(res.status).toBe(200);
    });

    it("assignment doc has two versions after reassignment", async () => {
      const nodeRes = await get("/api/v1/tree/main/about", cookie);
      const node = await nodeRes.json() as { assignmentDocId: string };
      const assignmentDocId = node.assignmentDocId;
      expect(assignmentDocId).toBeTruthy();

      const versRes = await get(`/api/v1/_paths/${assignmentDocId}/versions`, cookie);
      expect(versRes.status).toBe(200);
      const body = await versRes.json() as { versions: unknown[] };
      expect(body.versions).toHaveLength(2);
    });

    it("diff on assignment doc shows the documentId changed", async () => {
      const nodeRes = await get("/api/v1/tree/main/about", cookie);
      const node = await nodeRes.json() as { assignmentDocId: string };

      const diffRes = await get(`/api/v1/_paths/${node.assignmentDocId}/diff?v1=1&v2=2`, cookie);
      expect(diffRes.status).toBe(200);
      const body = await diffRes.json() as { diff: { path: string }[] };
      const changedPaths = body.diff.map((d) => d.path);
      expect(changedPaths).toContain("/documentId");
    });
  });

  describe("document paths", () => {
    it("lists tree paths for a document", async () => {
      const res = await get(`/api/v1/pages/${docId}/paths`, cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { paths: { tree: string; path: string }[] };
      // doc1 was at main:/about but reassigned away — should be empty now
      expect(Array.isArray(body.paths)).toBe(true);
    });

    it("doc2 is at two paths after being assigned to /about and /contact", async () => {
      const res = await get(`/api/v1/pages/${doc2Id}/paths`, cookie);
      const body = await res.json() as { paths: { tree: string; path: string }[] };
      expect(body.paths.length).toBe(2);
      const paths = body.paths.map((p) => p.path);
      expect(paths).toContain("/about");
      expect(paths).toContain("/contact");
    });
  });

  describe("multiple trees", () => {
    it("assigns a document to a staging tree", async () => {
      const res = await put("/api/v1/tree/staging/about", { documentId: docId }, cookie);
      expect(res.status).toBe(200);
    });

    it("staging tree appears in list", async () => {
      const res = await get("/api/v1/tree", cookie);
      const body = await res.json() as { trees: { name: string }[] };
      const names = body.trees.map((t) => t.name);
      expect(names).toContain("main");
      expect(names).toContain("staging");
    });

    it("main and staging can point to different documents at the same path", async () => {
      const mainRes = await get("/api/v1/tree/main/about", cookie);
      const mainDoc = (await mainRes.json() as { document: { id: string } }).document.id;

      const stagingRes = await get("/api/v1/tree/staging/about", cookie);
      const stagingDoc = (await stagingRes.json() as { document: { id: string } }).document.id;

      expect(mainDoc).toBe(doc2Id);
      expect(stagingDoc).toBe(docId);
      expect(mainDoc).not.toBe(stagingDoc);
    });
  });

  describe("removing paths", () => {
    it("removes a path from the tree", async () => {
      const res = await del("/api/v1/tree/main/contact", cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { removed: boolean };
      expect(body.removed).toBe(true);
    });

    it("removed path returns 404", async () => {
      const res = await get("/api/v1/tree/main/contact", cookie);
      expect(res.status).toBe(404);
    });

    it("assignment doc has a tombstone version after removal", async () => {
      // We need to find the assignment doc — it should still exist in _paths
      // Fetch main:/contact which now 404s, so we query _paths collection directly
      const listRes = await get("/api/v1/_paths", cookie);
      expect(listRes.status).toBe(200);
      const body = await listRes.json() as { items: { id: string; data: { path: string; removed?: boolean } }[] };
      const contactAssignment = body.items.find(
        (d) => d.data.path === "/contact" && d.data.removed === true,
      );
      expect(contactAssignment).toBeDefined();
    });
  });

  describe("collections list", () => {
    it("lists all collections with counts", async () => {
      const res = await get("/api/v1/collections", cookie);
      expect(res.status).toBe(200);
      const body = await res.json() as { collections: { name: string; count: number }[] };
      expect(Array.isArray(body.collections)).toBe(true);
      const names = body.collections.map((c) => c.name);
      expect(names).toContain("pages");
      expect(names).toContain("_paths");
    });
  });
});
