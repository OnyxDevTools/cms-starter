// filename: tests/unit/publication.test.ts
import { describe, it, expect } from "vitest";
import { Publishing } from "../../lib/publication";
import { MemoryStore } from "../fixture/memory";
import {
  normalizePath,
  safeURL,
  DocumentSchema,
  jsonLD,
  isIndexable,
  type RevisionInputType,
} from "../../lib/domain";
import { seed, seedId } from "../../scripts/seed";
const input = (
  path = "/example",
  title = "A useful title",
): RevisionInputType => ({
  path,
  title,
  summary: "A useful page description.",
  layout: "content",
  seoTitle: "",
  seoDescription: "",
  indexable: true,
  heroMediaId: "",
  toc: true,
  document: {
    version: 1,
    root: {
      type: "root",
      version: 1,
      children: [
        {
          type: "paragraph",
          version: 1,
          children: [{ type: "text", version: 1, text: "Published content" }],
        },
      ],
    },
  },
});

describe("publication boundary", () => {
  it("isolates drafts and preserves the former published revision", async () => {
    const service = new Publishing(new MemoryStore());
    let page = await service.create(input());
    expect(await service.publicPage("/example")).toBeNull();
    page = await service.publish(
      page.id,
      page.editToken,
      page.publicationToken,
    );
    const first = page.publishedRevisionId;
    page = await service.save(
      page.id,
      page.editToken,
      input("/example", "Draft title"),
    );
    expect((await service.publicPage("/example"))?.revision.title).toBe(
      "A useful title",
    );
    page = await service.publish(
      page.id,
      page.editToken,
      page.publicationToken,
    );
    expect((await service.publicPage("/example"))?.revision.title).toBe(
      "Draft title",
    );
    expect(page.previousPublishedRevisionId).toBe(first);
    await service.unpublish(page.id, page.publicationToken);
    expect(await service.publicPage("/example")).toBeNull();
  });
  it("claims routes with insert and redirects directly through stable page identity", async () => {
    const service = new Publishing(new MemoryStore());
    let one = await service.create(input("/first"));
    one = await service.publish(one.id, one.editToken, one.publicationToken);
    let two = await service.create(input("/second"));
    two = await service.publish(two.id, two.editToken, two.publicationToken);
    two = await service.save(two.id, two.editToken, input("/first"));
    await expect(
      service.publish(two.id, two.editToken, two.publicationToken),
    ).rejects.toMatchObject({ status: 409 });
    one = await service.save(one.id, one.editToken, input("/new"));
    expect(await service.publicPage("/new")).toBeNull();
    one = await service.publish(one.id, one.editToken, one.publicationToken);
    expect((await service.publicPage("/first"))?.redirect).toBe("/new");
    expect((await service.publicPage("/new"))?.redirect).toBeNull();
    await service.unpublish(one.id, one.publicationToken);
    one = await service.page(one.id);
    one = await service.publish(one.id, one.editToken, one.publicationToken);
    expect((await service.publicPage("/first"))?.redirect).toBe("/new");
  });
  it("serializes concurrent writers with durable insert locks", async () => {
    const store = new MemoryStore(),
      service = new Publishing(store),
      page = await service.create(input());
    const results = await Promise.allSettled([
      service.save(page.id, page.editToken, input("/example", "One")),
      service.save(page.id, page.editToken, input("/example", "Two")),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await store.get("PageLock", page.id)).toBeNull();
  });
  it("keeps the lock when a write outcome is uncertain", async () => {
    const store = new MemoryStore(),
      service = new Publishing(store),
      page = await service.create(input());
    const update = store.update.bind(store);
    store.update = async () => {
      throw Object.assign(new Error("transport lost"), { status: 503 });
    };
    await expect(
      service.save(page.id, page.editToken, input()),
    ).rejects.toThrow();
    store.update = update;
    expect(await store.get("PageLock", page.id)).not.toBeNull();
    await expect(
      service.save(page.id, page.editToken, input()),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects stale tokens and never converts a failed read into an empty result", async () => {
    const store = new MemoryStore(),
      service = new Publishing(store),
      page = await service.create(input());
    await expect(service.save(page.id, "stale", input())).rejects.toMatchObject(
      { status: 409 },
    );
    store.outage = true;
    await expect(service.publicPage("/example")).rejects.toMatchObject({
      status: 503,
    });
  });
  it("keeps draft media private and revokes public access on unpublish", async () => {
    const service = new Publishing(new MemoryStore());
    let page = await service.create(input());
    const id = "00000000-0000-4000-8000-000000000000";
    await service.store.insert("Media", {
      id,
      ownerPageId: page.id,
      ownerUid: "seed",
      name: "image",
      caption: "",
      deleted: false,
      documentId: id,
      width: 320,
      height: 200,
      mime: "image/png",
      alt: "A useful image",
      createdAt: new Date().toISOString(),
    });
    await expect(service.publishedMedia(id)).rejects.toMatchObject({
      status: 404,
    });
    const next = input();
    next.heroMediaId = id;
    page = await service.save(page.id, page.editToken, next);
    page = await service.publish(
      page.id,
      page.editToken,
      page.publicationToken,
    );
    expect((await service.publishedMedia(id)).id).toBe(id);
    await service.unpublish(page.id, page.publicationToken);
    await expect(service.publishedMedia(id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("seeds repeatably without replacing user edits or publication state", async () => {
    const service = new Publishing(new MemoryStore());
    await seed(service);
    const page = await service.page(seedId("/about"));
    await service.save(page.id, page.editToken, input("/about", "User draft"));
    await seed(service);
    expect(
      (await service.revision((await service.page(page.id)).draftRevisionId))
        .revision.title,
    ).toBe("User draft");
  });
});
describe("content and URL safety", () => {
  it("normalizes and rejects reserved/unsafe paths", () => {
    expect(normalizePath("/About/")).toBe("/about");
    for (const path of [
      "/admin",
      "/api/x",
      "//host/path",
      "/x/../y",
      "/x%2fy",
      "/a?b",
      "/sitemap.xml",
    ])
      expect(() => normalizePath(path)).toThrow();
  });
  it("rejects executable links and unsupported document nodes", () => {
    for (const url of [
      "javascript:alert(1)",
      "//other.test",
      "data:text/html,x",
      "https://a.test/x y",
    ])
      expect(() => safeURL(url)).toThrow();
    expect(safeURL("/about#section-1")).toBe("/about#section-1");
    expect(
      DocumentSchema.safeParse({
        version: 1,
        root: { type: "script", version: 1 },
      }).success,
    ).toBe(false);
  });
  it("safely serializes JSON-LD and keeps noindex distinct from public access", async () => {
    const value = jsonLD({ text: "</script><script>alert(1)</script>" });
    expect(value).not.toContain("<");
    expect(JSON.parse(value).text).toContain("</script>");
    const service = new Publishing(new MemoryStore());
    let page = await service.create({ ...input(), indexable: false });
    page = await service.publish(
      page.id,
      page.editToken,
      page.publicationToken,
    );
    const live = await service.publicPage("/example");
    expect(live).not.toBeNull();
    expect(isIndexable(page, live!.revision)).toBe(false);
  });
});
