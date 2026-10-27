// filename: tests/unit/cms.test.ts
import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { CMS, all } from "../../lib/cms/service";
import { MemoryStore } from "../fixture/memory";
import {
  DocumentSchema,
  RevisionInput,
  type RevisionInputType,
} from "../../lib/domain";
import type { EditorSession } from "../../lib/auth/provider";
const admin: EditorSession = {
    userId: "admin",
    name: "Administrator",
    roles: ["administrator"],
  },
  editor: EditorSession = {
    userId: "editor",
    name: "Editor",
    roles: ["editor"],
  },
  author: EditorSession = {
    userId: "author",
    name: "Author",
    roles: ["author"],
  };
const input = (
  path = "/story",
  title = "A published story",
): RevisionInputType => ({
  path,
  title,
  summary: "A useful story excerpt.",
  layout: "detail",
  contentType: "post",
  seoTitle: "",
  seoDescription: "",
  indexable: true,
  heroMediaId: "",
  toc: false,
  document: {
    version: 1,
    root: {
      type: "root",
      version: 1,
      children: [
        {
          type: "paragraph",
          version: 1,
          children: [{ type: "text", version: 1, text: title }],
        },
      ],
    },
  },
});
describe("CMS editorial workflow on test-only store", () => {
  it("isolates autosaves, creates history only at meaningful saves and detects stale editors", async () => {
    const service = new CMS(new MemoryStore());
    let page = await service.createDraft(author, input());
    page = await service.publishDraft(
      editor,
      page.id,
      page.editToken,
      page.publicationToken,
      input(),
    );
    const live = page.publishedRevisionId,
      old = page.editToken,
      revisionCount = (await all(service.store, "PageRevision")).length;
    page = await service.checkpoint(
      author,
      page.id,
      page.editToken,
      input("/story", "Unpublished edits"),
    );
    expect((await service.publicPage("/story"))?.revision.title).toBe(
      "A published story",
    );
    expect((await service.draft(author, page.id)).revision.title).toBe(
      "Unpublished edits",
    );
    expect((await all(service.store, "PageRevision")).length).toBe(
      revisionCount,
    );
    await expect(
      service.checkpoint(author, page.id, old, input()),
    ).rejects.toMatchObject({ status: 409 });
    page = await service.saveDraft(
      author,
      page.id,
      page.editToken,
      input("/story", "Saved changes"),
    );
    expect(page.publishedRevisionId).toBe(live);
    expect(await service.store.get("WorkingDraft", page.id)).toBeNull();
    page = await service.publishDraft(
      editor,
      page.id,
      page.editToken,
      page.publicationToken,
      input("/new-story", "New live version"),
    );
    expect((await service.publicPage("/story"))?.redirect).toBe("/new-story");
    expect((await service.publicPage("/new-story"))?.revision.title).toBe(
      "New live version",
    );
    page = await service.restoreRevision(author, page.id, live, page.editToken);
    expect(page.publishedRevisionId).not.toBe(live);
    expect((await service.publicPage("/new-story"))?.revision.title).toBe(
      "New live version",
    );
    await service.unpublishContent(editor, page.id, page.publicationToken);
    expect(await service.publicPage("/story")).toBeNull();
    expect(await service.publicPage("/new-story")).toBeNull();
  });
  it("enforces roles and owner scope independently of the client", async () => {
    const service = new CMS(new MemoryStore()),
      page = await service.createDraft(author, input());
    await expect(
      service.draft({ ...author, userId: "stranger" }, page.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.publishDraft(
        author,
        page.id,
        page.editToken,
        page.publicationToken,
        input(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.settingsUpdate(editor, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.userUpdate(author, {})).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await service.listContent({ ...author, userId: "stranger" }),
    ).toEqual([]);
    expect((await service.draft(editor, page.id)).page.id).toBe(page.id);
  });
  it("keeps published slugs unique and does not activate draft redirects", async () => {
    const service = new CMS(new MemoryStore());
    const a = await service.createDraft(admin, input()),
      b = await service.createDraft(admin, input("/second"));
    await service.publishDraft(
      editor,
      a.id,
      a.editToken,
      a.publicationToken,
      input(),
    );
    await expect(
      service.publishDraft(
        editor,
        b.id,
        b.editToken,
        b.publicationToken,
        input(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const page = await service.page(a.id);
    await service.checkpoint(admin, a.id, page.editToken, input("/draft-path"));
    expect(await service.publicPage("/draft-path")).toBeNull();
    expect((await service.publicPage("/story"))?.redirect).toBeNull();
  });
  it("archives by unpublishing and restores without republishing", async () => {
    const service = new CMS(new MemoryStore());
    let page = await service.createDraft(admin, input());
    page = await service.publishDraft(
      admin,
      page.id,
      page.editToken,
      page.publicationToken,
      input(),
    );
    page = await service.archive(editor, page.id, page.editToken, true);
    expect(await service.publicPage("/story")).toBeNull();
    page = await service.archive(editor, page.id, page.editToken, false);
    expect(page.publishedRevisionId).toBe("");
    expect(page.archived).toBe(false);
  });
  it("scopes media and blocks removal of published or site-referenced images", async () => {
    const service = new CMS(new MemoryStore());
    let page = await service.createDraft(author, input());
    const id = randomUUID();
    await service.store.insert("Media", {
      id,
      ownerPageId: page.id,
      ownerUid: author.userId,
      name: "sample.png",
      caption: "Example",
      deleted: false,
      documentId: id,
      width: 320,
      height: 200,
      mime: "image/png",
      alt: "A sample",
      createdAt: new Date().toISOString(),
    });
    await service.store.saveDocument(id, "image/png", Buffer.from("fixture"));
    await expect(
      service.mediaAccess({ ...author, userId: "other" }, id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.publishedMedia(id)).rejects.toMatchObject({
      status: 404,
    });
    await service.store.insert("SiteSettings", {
      id: "site",
      name: "CMS",
      description: "Example website",
      origin: "https://example.test",
      organizationName: "",
      organizationURL: "",
      logoMediaId: "",
      socialMediaId: "",
      footerText: "Footer",
      updatedAt: new Date().toISOString(),
    });
    page = await service.publishDraft(
      editor,
      page.id,
      page.editToken,
      page.publicationToken,
      { ...input(), heroMediaId: id },
    );
    expect((await service.publishedMedia(id)).id).toBe(id);
    await expect(
      service.editMedia(author, id, {
        alt: "An unauthorized public update",
        caption: "",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await service.mediaAccess(admin, id)).alt).toBe("A sample");
    await expect(service.deleteMedia(editor, id)).rejects.toMatchObject({
      status: 409,
    });
    await service.unpublishContent(editor, page.id, page.publicationToken);
    await service.deleteMedia(editor, id);
    await expect(service.mediaAccess(admin, id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("rejects unsafe links, unknown nodes, malformed tables and foreign revisions", async () => {
    expect(() =>
      DocumentSchema.parse({
        version: 1,
        root: {
          type: "root",
          version: 1,
          children: [{ type: "link", version: 1, url: "javascript:alert(1)" }],
        },
      }),
    ).toThrow();
    expect(() =>
      DocumentSchema.parse({
        version: 1,
        root: {
          type: "root",
          version: 1,
          children: [{ type: "script", version: 1, text: "danger" }],
        },
      }),
    ).toThrow();
    expect(() =>
      DocumentSchema.parse({
        version: 1,
        root: {
          type: "root",
          version: 1,
          children: [{ type: "tablecell", version: 1 }],
        },
      }),
    ).toThrow();
    const service = new CMS(new MemoryStore()),
      a = await service.createDraft(author, input()),
      b = await service.createDraft(author, input("/other"));
    await expect(
      service.restoreRevision(author, a.id, b.draftRevisionId, a.editToken),
    ).rejects.toMatchObject({ status: 403 });
    expect(() =>
      RevisionInput.parse({ ...input(), path: "/sign-in" }),
    ).toThrow();
  });
  it("retains one administrator and preserves cloned image ownership", async () => {
    const service = new CMS(new MemoryStore()),
      now = new Date().toISOString(),
      grant = {
        id: admin.userId,
        email: "admin@example.test",
        name: admin.name,
        role: "administrator" as const,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
    await service.store.insert("CMSUser", grant);
    await expect(
      service.userUpdate(admin, { ...grant, active: false }),
    ).rejects.toMatchObject({ status: 409 });
    const page = await service.createDraft(author, input()),
      id = randomUUID();
    await service.store.saveDocument(
      id,
      "image/png",
      Buffer.from("fixture-image"),
    );
    await service.store.insert("Media", {
      id,
      ownerPageId: page.id,
      ownerUid: author.userId,
      name: "sample.png",
      caption: "Image caption",
      deleted: false,
      documentId: id,
      width: 320,
      height: 200,
      mime: "image/png",
      alt: "A sample image",
      createdAt: now,
    });
    const doc = input();
    doc.document.root.children!.push({
      type: "image",
      version: 1,
      mediaId: id,
      alt: "A sample image",
    });
    const saved = await service.saveDraft(author, page.id, page.editToken, {
      ...doc,
      heroMediaId: id,
    });
    const copy = await service.duplicate(author, saved.id),
      draft = await service.draft(author, copy.id),
      images = await all(service.store, "Media", { ownerPageId: copy.id });
    expect(images).toHaveLength(1);
    expect(images[0]!.id).not.toBe(id);
    expect(draft.revision.heroMediaId).toBe(images[0]!.id);
    expect(copy.publishedRevisionId).toBe("");
    expect(await service.store.document(images[0]!.documentId)).toEqual(
      Buffer.from("fixture-image"),
    );
  });
  it("checks revision ownership before reading private document nodes", async () => {
    const store = new MemoryStore(),
      service = new CMS(store),
      a = await service.createDraft(author, input()),
      b = await service.createDraft(admin, input("/private-other")),
      spy = vi.spyOn(store, "list");
    await expect(
      service.restoreRevision(author, a.id, b.draftRevisionId, a.editToken),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      spy.mock.calls.some(
        ([table, options]) =>
          table === "PageNode" &&
          options?.where &&
          "revisionId" in options.where &&
          options.where.revisionId === b.draftRevisionId,
      ),
    ).toBe(false);
  });
});
