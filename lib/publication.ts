// filename: lib/publication.ts
import { randomUUID } from "node:crypto";
import {
  AppError,
  DocumentSchema,
  RevisionInput,
  SiteSchema,
  NavigationSchema,
  flatten,
  inflate,
  normalizePath,
  isPublic,
  type Document,
  type Page,
  type RevisionInputType,
} from "./domain";
import type { Store } from "./repository";

export class Publishing {
  constructor(readonly store: Store) {}
  async locked<T>(id: string, operation: () => Promise<T>): Promise<T> {
    try {
      await this.store.insert("PageLock", {
        id,
        ownerToken: randomUUID(),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError && error.status === 409)
        throw new AppError(
          409,
          "This page is being changed or needs lock recovery. Reload after the current save completes.",
        );
      throw error;
    }
    let release = false;
    try {
      const result = await operation();
      release = true;
      return result;
    } catch (error) {
      release = error instanceof AppError && error.status < 500;
      throw error;
    } finally {
      if (release) await this.store.delete("PageLock", id);
    }
  }
  async save(id: string, token: string, input: RevisionInputType) {
    const parsed = RevisionInput.parse(input);
    return this.locked(id, () => this.saveUnlocked(id, token, parsed));
  }
  async publish(id: string, editToken: string, publicationToken: string) {
    return this.locked(id, () =>
      this.publishUnlocked(id, editToken, publicationToken),
    );
  }
  async unpublish(id: string, publicationToken: string) {
    return this.locked(id, () => this.unpublishUnlocked(id, publicationToken));
  }

  async page(id: string) {
    const page = await this.store.get("Page", id);
    if (!page) throw new AppError(404, "Page not found.");
    return page;
  }
  async revision(id: string, expectedPageId?: string) {
    const revision = await this.store.get("PageRevision", id);
    if (!revision) throw new AppError(503, "Referenced revision is missing.");
    if (expectedPageId && revision.pageId !== expectedPageId)
      throw new AppError(
        503,
        "Revision ownership does not match the content item.",
      );
    const rows = await this.store.list("PageNode", {
      where: { revisionId: id },
      limit: 257,
    });
    if (rows.cursor)
      throw new AppError(503, "Revision exceeds its node limit.");
    return { revision, document: inflate(rows.items) };
  }
  async snapshot(input: RevisionInputType, pageId: string) {
    const value = RevisionInput.parse(input);
    const id = randomUUID();
    const { document, ...fields } = value;
    const revision = {
      ...fields,
      id,
      pageId,
      documentVersion: 1 as const,
      createdAt: new Date().toISOString(),
    };
    // Complete immutable content first. A failed write leaves unreachable rows,
    // never a partially visible live revision.
    await this.store.insert("PageRevision", revision);
    for (const row of flatten(id, document))
      await this.store.insert("PageNode", row);
    return revision;
  }
  async claim(path: string, pageId: string) {
    try {
      await this.store.insert("Route", {
        id: path,
        pageId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 409) throw error;
      const existing = await this.store.get("Route", path);
      if (existing?.pageId !== pageId)
        throw new AppError(
          409,
          "That route belongs to another page or redirect.",
        );
    }
  }
  async create(input: RevisionInputType) {
    const parsed = RevisionInput.parse(input),
      id = randomUUID(),
      now = new Date().toISOString();
    await this.claim(parsed.path, id);
    const revision = await this.snapshot(parsed, id);
    const page: Page = {
      id,
      ownerUid: parsed.actorUid,
      archived: false,
      path: parsed.path,
      draftRevisionId: revision.id,
      publishedRevisionId: "",
      previousPublishedRevisionId: "",
      editToken: randomUUID(),
      publicationToken: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.insert("Page", page);
    return page;
  }
  async saveUnlocked(id: string, token: string, input: RevisionInputType) {
    const page = await this.page(id);
    if (page.editToken !== token)
      throw new AppError(409, "The draft changed. Reload before saving.");
    const revision = await this.snapshot(input, id);
    const next = randomUUID();
    if (
      !(await this.store.update(
        "Page",
        id,
        { editToken: token },
        {
          path: revision.path,
          draftRevisionId: revision.id,
          editToken: next,
          updatedAt: new Date().toISOString(),
        },
      ))
    )
      throw new AppError(409, "The draft changed. Reload before saving.");
    return {
      ...page,
      path: revision.path,
      draftRevisionId: revision.id,
      editToken: next,
    };
  }
  async mediaReferences(document: Document, heroMediaId: string) {
    const ids = new Set<string>();
    if (heroMediaId) ids.add(heroMediaId);
    const visit = (node: Document["root"]) => {
      if (node.mediaId) ids.add(node.mediaId);
      node.children?.forEach(visit);
    };
    visit(document.root);
    return ids;
  }
  async publishUnlocked(
    id: string,
    editToken: string,
    publicationToken: string,
  ) {
    const page = await this.page(id);
    if (page.archived)
      throw new AppError(409, "Restore this content before publishing.");
    if (
      page.editToken !== editToken ||
      page.publicationToken !== publicationToken
    )
      throw new AppError(409, "The page changed. Reload before publishing.");
    const { revision, document } = await this.revision(
      page.draftRevisionId,
      id,
    );
    DocumentSchema.parse(document);
    await this.claim(revision.path, id);
    if (revision.socialMediaId) {
      const social = await this.store.get("Media", revision.socialMediaId);
      if (!social || social.deleted || social.ownerPageId !== id)
        throw new AppError(422, "Social image must belong to this content.");
    }
    for (const mediaId of await this.mediaReferences(
      document,
      revision.heroMediaId,
    )) {
      const media = await this.store.get("Media", mediaId);
      if (!media || media.deleted || media.ownerPageId !== id)
        throw new AppError(422, "Published images must belong to this page.");
    }
    const paths = new Set([revision.path]);
    const prior = page.publishedRevisionId || page.previousPublishedRevisionId;
    if (prior) {
      const old = await this.store.list("PublicationPath", {
        where: { revisionId: prior },
        limit: 101,
      });
      if (old.cursor || old.items.length > 99)
        throw new AppError(422, "This page has reached its URL history limit.");
      old.items.forEach((row) => paths.add(row.path));
    }
    // Include all accepted paths in an immutable manifest before changing the
    // live pointer. A reserved new URL is not exposed by an older publication.
    for (const path of paths) {
      const key = `${revision.id}:${path}`;
      const existing = await this.store.get("PublicationPath", key);
      if (!existing)
        await this.store.insert("PublicationPath", {
          id: key,
          revisionId: revision.id,
          path,
        });
    }
    if (
      !(await this.store.update(
        "Page",
        id,
        { editToken, publicationToken },
        {
          publishedRevisionId: revision.id,
          previousPublishedRevisionId: prior,
          publicationToken: randomUUID(),
          updatedAt: new Date().toISOString(),
        },
      ))
    )
      throw new AppError(409, "The page changed. Reload before publishing.");
    return this.page(id);
  }
  async unpublishUnlocked(id: string, publicationToken: string) {
    const page = await this.page(id);
    if (
      !(await this.store.update(
        "Page",
        id,
        { publicationToken },
        {
          publishedRevisionId: "",
          previousPublishedRevisionId:
            page.publishedRevisionId || page.previousPublishedRevisionId,
          publicationToken: randomUUID(),
          updatedAt: new Date().toISOString(),
        },
      ))
    )
      throw new AppError(409, "The publication changed. Reload first.");
  }
  async publicPage(path: string) {
    path = normalizePath(path);
    const route = await this.store.get("Route", path);
    if (!route) return null;
    const page = await this.store.get("Page", route.pageId);
    if (!page || !isPublic(page)) return null;
    const manifest = await this.store.get(
      "PublicationPath",
      `${page.publishedRevisionId}:${path}`,
    );
    if (!manifest) return null;
    const snapshot = await this.revision(page.publishedRevisionId, page.id);
    return {
      page,
      ...snapshot,
      redirect: snapshot.revision.path !== path ? snapshot.revision.path : null,
    };
  }
  async collection(pageNumber: number) {
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 100)
      throw new AppError(404, "Collection page not found.");
    let cursor: string | undefined;
    const accepted: { page: Page; revision: import("./domain").Revision }[] =
      [];
    let skip = (pageNumber - 1) * 2;
    for (let batch = 0; batch < 100; batch++) {
      const result = await this.store.list("Page", { cursor, limit: 20 });
      const revisions = await Promise.all(
        result.items.map((page) =>
          page.publishedRevisionId
            ? this.store.get("PageRevision", page.publishedRevisionId)
            : null,
        ),
      );
      for (const [index, revision] of revisions.entries()) {
        if (
          !revision ||
          !isPublic(result.items[index]) ||
          revision.layout !== "detail"
        )
          continue;
        if (skip > 0) {
          skip--;
          continue;
        }
        accepted.push({ page: result.items[index], revision });
        if (accepted.length === 3)
          return { items: accepted.slice(0, 2), hasNext: true };
      }
      cursor = result.cursor;
      if (!cursor) return { items: accepted, hasNext: false };
    }
    throw new AppError(
      503,
      "Collection scan limit exceeded; add a publication index before increasing scale.",
    );
  }
  async publishedMedia(id: string) {
    const media = await this.store.get("Media", id);
    if (!media || media.deleted) throw new AppError(404, "Image not found.");
    const site = await this.store.get("SiteSettings", "site");
    if (site && (site.logoMediaId === id || site.socialMediaId === id))
      return media;
    const page = await this.store.get("Page", media.ownerPageId);
    if (!page?.publishedRevisionId || page.archived)
      throw new AppError(404, "Image not found.");
    const { revision, document } = await this.revision(
      page.publishedRevisionId,
      page.id,
    );
    if (
      revision.socialMediaId !== id &&
      !(await this.mediaReferences(document, revision.heroMediaId)).has(id)
    )
      throw new AppError(404, "Image not found.");
    return media;
  }
  async settings() {
    const site = await this.store.get("SiteSettings", "site");
    if (!site)
      throw new AppError(
        503,
        "Site settings are missing. Run the explicit seed command.",
      );
    return site;
  }
  async navigation() {
    const result = await this.store.list("NavigationLink", { limit: 33 });
    if (result.cursor || result.items.length > 32)
      throw new AppError(503, "Navigation exceeds its configured limit.");
    return result.items.sort((a, b) => a.position - b.position);
  }
  async saveSettings(value: unknown) {
    const site = SiteSchema.parse(value);
    if (site.organizationURL) {
      const u = new URL(site.organizationURL);
      if (u.protocol !== "https:")
        throw new AppError(422, "Organization URL must use HTTPS.");
    }
    const existing = await this.store.get("SiteSettings", "site");
    if (existing)
      await this.store.update(
        "SiteSettings",
        "site",
        {},
        { ...site, updatedAt: new Date().toISOString() },
      );
    else await this.store.insert("SiteSettings", site);
  }
  async saveNavigation(value: unknown) {
    const rows = NavigationSchema.array().max(32).parse(value);
    const existing = await this.navigation();
    const ids = new Set(existing.map((row) => row.id));
    for (const row of existing)
      if (!rows.some((r) => r.id === row.id))
        await this.store.update(
          "NavigationLink",
          row.id,
          {},
          { enabled: false },
        );
    for (const row of rows) {
      if (ids.has(row.id))
        await this.store.update("NavigationLink", row.id, {}, row);
      else await this.store.insert("NavigationLink", row);
    }
  }
}
