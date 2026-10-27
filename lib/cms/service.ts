// filename: lib/cms/service.ts
import { randomUUID } from "node:crypto";
import {
  AppError,
  RevisionInput,
  NavigationSchema,
  SiteSchema,
  TermSchema,
  UserSchema,
  inflate,
  flatten,
  type Rows,
  type Table,
  type RevisionInputType,
} from "../domain";
import { Publishing } from "../publication";
import type { Store } from "../repository";
import type { EditorSession } from "../auth/provider";
export async function all<K extends Table>(
  store: Store,
  table: K,
  where: Partial<Rows[K]> = {},
  maximum = 2000,
) {
  const rows: Rows[K][] = [];
  let cursor: string | undefined;
  do {
    const page = await store.list(table, { where, limit: 100, cursor });
    rows.push(...page.items);
    if (rows.length > maximum)
      throw new AppError(
        503,
        "The bounded CMS scan budget was exceeded. Add an indexed listing before expanding this site.",
      );
    cursor = page.cursor;
  } while (cursor);
  return rows;
}
export function role(actor: EditorSession, allowed: EditorSession["roles"]) {
  if (!actor.userId || !actor.roles.some((r) => allowed.includes(r)))
    throw new AppError(403, "Your CMS role does not allow this operation.");
}
export class CMS extends Publishing {
  async authorized(actor: EditorSession, id: string) {
    role(actor, ["administrator", "editor", "author"]);
    const page = await this.page(id);
    if (
      actor.roles.includes("author") &&
      !actor.roles.some((r) => r === "editor" || r === "administrator") &&
      page.ownerUid !== actor.userId
    )
      throw new AppError(403, "Authors can access only their own content.");
    return page;
  }
  async activity(actor: EditorSession, pageId: string, action: string) {
    await this.store.insert("Activity", {
      id: randomUUID(),
      pageId,
      actorUid: actor.userId,
      actorName: actor.name,
      action,
      createdAt: new Date().toISOString(),
    });
  }
  input(actor: EditorSession, input: RevisionInputType, action: string) {
    return RevisionInput.parse({
      ...input,
      actorUid: actor.userId,
      action,
      authorName: input.authorName || actor.name,
    });
  }
  async draft(actor: EditorSession, id: string) {
    const page = await this.authorized(actor, id),
      working = await this.store.get("WorkingDraft", id);
    if (working) {
      if (working.pageId !== id)
        throw new AppError(
          503,
          "Working draft ownership does not match this item.",
        );
      const nodes = await all(
        this.store,
        "DraftNode",
        { revisionId: working.nodeSetId },
        256,
      );
      return {
        page,
        revision: working,
        document: inflate(nodes),
        working: true,
      };
    }
    return {
      page,
      ...(await this.revision(page.draftRevisionId, page.id)),
      working: false,
    };
  }
  async createDraft(actor: EditorSession, input: RevisionInputType) {
    role(actor, ["administrator", "editor", "author"]);
    const page = await this.create(this.input(actor, input, "create"));
    await this.activity(actor, page.id, "Created draft");
    return page;
  }
  async checkpoint(
    actor: EditorSession,
    id: string,
    token: string,
    input: RevisionInputType,
  ) {
    await this.authorized(actor, id);
    const parsed = this.input(actor, input, "autosave");
    return this.locked(id, async () => {
      const page = await this.authorized(actor, id);
      if (page.editToken !== token)
        throw new AppError(
          409,
          "Another editor changed this draft. Your unsaved text is preserved; reload in another tab to compare before retrying.",
        );
      if (page.archived)
        throw new AppError(409, "Restore archived content before editing.");
      const old = await this.store.get("WorkingDraft", id),
        { document, ...fields } = parsed,
        nodeSetId = randomUUID(),
        now = new Date().toISOString();
      for (const node of flatten(nodeSetId, document))
        await this.store.insert("DraftNode", node);
      const row: Rows["WorkingDraft"] = {
        ...fields,
        id,
        pageId: id,
        nodeSetId,
        documentVersion: 1,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      if (old) await this.store.update("WorkingDraft", id, {}, row);
      else await this.store.insert("WorkingDraft", row);
      const next = {
        ...page,
        path: parsed.path,
        editToken: randomUUID(),
        updatedAt: now,
      };
      if (!(await this.store.update("Page", id, { editToken: token }, next)))
        throw new AppError(
          409,
          "The draft changed before its checkpoint completed.",
        );
      if (old)
        for (const node of await all(
          this.store,
          "DraftNode",
          { revisionId: old.nodeSetId },
          256,
        ))
          await this.store.delete("DraftNode", node.id);
      return next;
    });
  }
  async clearWorking(id: string) {
    const working = await this.store.get("WorkingDraft", id);
    if (working) {
      await this.store.delete("WorkingDraft", id);
      for (const node of await all(
        this.store,
        "DraftNode",
        { revisionId: working.nodeSetId },
        256,
      ))
        await this.store.delete("DraftNode", node.id);
    }
  }
  async saveDraft(
    actor: EditorSession,
    id: string,
    token: string,
    input: RevisionInputType,
    action = "save",
  ) {
    await this.authorized(actor, id);
    return this.locked(id, async () => {
      const page = await this.authorized(actor, id);
      if (page.archived)
        throw new AppError(409, "Restore archived content first.");
      const next = await this.saveUnlocked(
        id,
        token,
        this.input(actor, input, action),
      );
      await this.clearWorking(id);
      await this.activity(actor, id, "Saved revision");
      return next;
    });
  }
  async publishDraft(
    actor: EditorSession,
    id: string,
    token: string,
    pubToken: string,
    input: RevisionInputType,
  ) {
    role(actor, ["administrator", "editor"]);
    await this.authorized(actor, id);
    return this.locked("media-publication", () =>
      this.locked(id, async () => {
        const current = await this.authorized(actor, id);
        if (current.publicationToken !== pubToken)
          throw new AppError(
            409,
            "Publication changed. Reload before publishing.",
          );
        const parsed = this.input(
          actor,
          {
            ...input,
            publishedAt: input.publishedAt || new Date().toISOString(),
          },
          "publish",
        );
        for (const termId of parsed.terms.split(",").filter(Boolean)) {
          const term = await this.store.get("Taxonomy", termId);
          if (!term || term.archived)
            throw new AppError(
              422,
              "Choose active categories and tags before publishing.",
            );
        }
        await this.saveUnlocked(id, token, parsed);
        const saved = await this.page(id),
          result = await this.publishUnlocked(
            id,
            saved.editToken,
            saved.publicationToken,
          );
        await this.clearWorking(id);
        await this.activity(actor, id, "Published content");
        return result;
      }),
    );
  }
  async unpublishContent(actor: EditorSession, id: string, pubToken: string) {
    role(actor, ["administrator", "editor"]);
    await this.authorized(actor, id);
    return this.locked(id, async () => {
      await this.unpublishUnlocked(id, pubToken);
      await this.activity(actor, id, "Unpublished content");
      return this.page(id);
    });
  }
  async archive(
    actor: EditorSession,
    id: string,
    token: string,
    archived: boolean,
  ) {
    role(actor, ["administrator", "editor"]);
    return this.locked(id, async () => {
      const page = await this.authorized(actor, id);
      if (page.editToken !== token)
        throw new AppError(409, "Content changed. Reload before archiving.");
      if (archived && page.publishedRevisionId)
        await this.unpublishUnlocked(id, page.publicationToken);
      await this.store.update(
        "Page",
        id,
        { editToken: token },
        {
          archived,
          editToken: randomUUID(),
          updatedAt: new Date().toISOString(),
        },
      );
      await this.activity(
        actor,
        id,
        archived ? "Archived content" : "Restored archived content",
      );
      return this.page(id);
    });
  }
  async restoreRevision(
    actor: EditorSession,
    id: string,
    revisionId: string,
    token: string,
  ) {
    await this.authorized(actor, id);
    const match = await this.store.list("PageRevision", {
      where: { id: revisionId, pageId: id },
      limit: 1,
    });
    if (!match.items.length)
      throw new AppError(403, "Revision belongs to another content item.");
    const snapshot = await this.revision(revisionId, id);
    if (snapshot.revision.pageId !== id)
      throw new AppError(403, "Revision belongs to another content item.");
    const page = await this.saveDraft(
      actor,
      id,
      token,
      this.input(
        actor,
        { ...snapshot.revision, document: snapshot.document },
        "restore",
      ),
      "restore",
    );
    await this.activity(actor, id, "Restored a revision into a draft");
    return page;
  }
  async duplicate(actor: EditorSession, id: string) {
    const { revision, document } = await this.draft(actor, id);
    let copy = await this.createDraft(actor, {
      ...revision,
      path: `${revision.path === "/" ? "/page" : revision.path.slice(0, 160)}-copy-${randomUUID().slice(0, 8)}`,
      title: `${revision.title.slice(0, 105)} (copy)`,
      heroMediaId: "",
      socialMediaId: "",
      canonicalPath: "",
      publishedAt: "",
      document: {
        version: 1,
        root: { type: "root", version: 1, children: [] },
      },
    });
    const ids = await this.mediaReferences(document, revision.heroMediaId);
    if (revision.socialMediaId) ids.add(revision.socialMediaId);
    const mapped = new Map<string, string>();
    for (const mediaId of ids) {
      const media = await this.mediaAccess(actor, mediaId),
        next = randomUUID(),
        bytes = await this.store.document(media.documentId);
      await this.store.saveDocument(next, media.mime, bytes);
      await this.store.insert("Media", {
        ...media,
        id: next,
        documentId: next,
        ownerPageId: copy.id,
        ownerUid: actor.userId,
        createdAt: new Date().toISOString(),
      });
      mapped.set(mediaId, next);
    }
    const replace = (node: typeof document.root): typeof document.root => ({
      ...node,
      ...(node.mediaId ? { mediaId: mapped.get(node.mediaId) || "" } : {}),
      ...(node.children ? { children: node.children.map(replace) } : {}),
    });
    copy = await this.saveDraft(actor, copy.id, copy.editToken, {
      ...revision,
      path: copy.path,
      title: `${revision.title.slice(0, 105)} (copy)`,
      heroMediaId: mapped.get(revision.heroMediaId) || "",
      socialMediaId: mapped.get(revision.socialMediaId) || "",
      canonicalPath: "",
      publishedAt: "",
      document: { version: 1, root: replace(document.root) },
    });
    await this.activity(actor, copy.id, "Duplicated content and media");
    return copy;
  }
  async listContent(actor: EditorSession) {
    role(actor, ["administrator", "editor", "author"]);
    const pages = await all(
      this.store,
      "Page",
      actor.roles.includes("author") ? { ownerUid: actor.userId } : {},
    );
    const rows = [];
    for (let start = 0; start < pages.length; start += 20)
      rows.push(
        ...(await Promise.all(
          pages.slice(start, start + 20).map(async (page) => {
            const working = await this.store.get("WorkingDraft", page.id),
              revision =
                working ||
                (await this.revision(page.draftRevisionId, page.id)).revision;
            return {
              id: page.id,
              title: revision.title,
              path: revision.path,
              kind: revision.contentType,
              status: page.archived
                ? "Archived"
                : page.publishedRevisionId
                  ? working || page.draftRevisionId !== page.publishedRevisionId
                    ? "Published · draft changes"
                    : "Published"
                  : "Draft",
              author: revision.authorName,
              updatedAt: page.updatedAt,
            };
          }),
        )),
      );
    return rows;
  }
  async mediaAccess(actor: EditorSession, id: string) {
    role(actor, ["administrator", "editor", "author"]);
    const media = await this.store.get("Media", id);
    if (!media || media.deleted) throw new AppError(404, "Image not found.");
    await this.authorized(actor, media.ownerPageId);
    return media;
  }
  async mediaList(actor: EditorSession) {
    role(actor, ["administrator", "editor", "author"]);
    const media = await all(this.store, "Media", { deleted: false });
    const rows = [];
    for (const image of media) {
      try {
        await this.authorized(actor, image.ownerPageId);
      } catch (e) {
        if (e instanceof AppError && e.status === 403) continue;
        throw e;
      }
      const page = await this.page(image.ownerPageId),
        publicAsset = await this.publishedMedia(image.id)
          .then(() => true)
          .catch((e) => {
            if (e instanceof AppError && e.status === 404) return false;
            throw e;
          });
      rows.push({
        ...image,
        visibility: publicAsset ? "Public" : "Private draft",
        usage: page.path,
      });
    }
    return rows;
  }
  async editMedia(
    actor: EditorSession,
    id: string,
    value: { alt: string; caption: string },
  ) {
    return this.locked("media-publication", async () => {
      await this.mediaAccess(actor, id);
      if (actor.roles.includes("author")) {
        const publicAsset = await this.publishedMedia(id)
          .then(() => true)
          .catch((error) => {
            if (error instanceof AppError && error.status === 404) return false;
            throw error;
          });
        if (publicAsset)
          throw new AppError(
            403,
            "This image is public. An editor must update its metadata.",
          );
      }
      if (
        !value.alt.trim() ||
        value.alt.length > 240 ||
        value.caption.length > 500
      )
        throw new AppError(
          422,
          "Add alt text up to 240 characters and a caption up to 500.",
        );
      await this.store.update("Media", id, {}, value);
      await this.activity(actor, "", "Updated media description");
    });
  }
  async deleteMedia(actor: EditorSession, id: string) {
    role(actor, ["administrator", "editor"]);
    return this.locked("media-publication", async () => {
      const media = await this.mediaAccess(actor, id);
      const site = await this.settings();
      if (site.logoMediaId === id || site.socialMediaId === id)
        throw new AppError(409, "This image is used by site settings.");
      for (const page of await all(this.store, "Page")) {
        if (!page.publishedRevisionId) continue;
        const { revision, document } = await this.revision(
          page.publishedRevisionId,
        );
        if (
          revision.socialMediaId === id ||
          (await this.mediaReferences(document, revision.heroMediaId)).has(id)
        )
          throw new AppError(
            409,
            "This image is still used by published content.",
          );
      }
      await this.store.update("Media", id, {}, { ...media, deleted: true });
      await this.activity(
        actor,
        media.ownerPageId,
        "Removed media from library",
      );
    });
  }
  async terms(actor: EditorSession) {
    role(actor, ["administrator", "editor", "author"]);
    return all(this.store, "Taxonomy");
  }
  async saveTerm(actor: EditorSession, value: unknown) {
    role(actor, ["administrator", "editor"]);
    const term = TermSchema.parse(value);
    return this.locked("taxonomy", async () => {
      const existing = await this.terms(actor);
      if (
        existing.some(
          (t) =>
            t.id !== term.id && t.kind === term.kind && t.slug === term.slug,
        )
      )
        throw new AppError(409, "This taxonomy slug is already used.");
      if (await this.store.get("Taxonomy", term.id))
        await this.store.update("Taxonomy", term.id, {}, term);
      else await this.store.insert("Taxonomy", term);
      await this.activity(actor, "", "Updated taxonomy");
      return term;
    });
  }
  async settingsUpdate(actor: EditorSession, value: unknown) {
    role(actor, ["administrator"]);
    return this.locked("media-publication", () =>
      this.locked("settings", async () => {
        const site = SiteSchema.parse(value);
        for (const id of [site.logoMediaId, site.socialMediaId].filter(Boolean))
          await this.mediaAccess(actor, id);
        await this.saveSettings(site);
        await this.activity(actor, "", "Updated public site settings");
      }),
    );
  }
  async navigationUpdate(actor: EditorSession, value: unknown) {
    role(actor, ["administrator", "editor"]);
    return this.locked("navigation", async () => {
      const links = NavigationSchema.array().max(32).parse(value);
      for (const link of links) {
        if (!link.pageId)
          throw new AppError(422, "Navigation must reference a content item.");
        await this.authorized(actor, link.pageId);
      }
      await this.saveNavigation(links);
      await this.activity(actor, "", "Updated public navigation");
    });
  }
  async userUpdate(actor: EditorSession, value: unknown) {
    role(actor, ["administrator"]);
    const user = UserSchema.parse(value);
    return this.locked("users", async () => {
      const users = await all(this.store, "CMSUser"),
        prior = await this.store.get("CMSUser", user.id);
      if (
        prior?.active &&
        prior.role === "administrator" &&
        (!user.active || user.role !== "administrator") &&
        users.filter((u) => u.active && u.role === "administrator").length <= 1
      )
        throw new AppError(409, "Keep at least one active administrator.");
      if (prior) await this.store.update("CMSUser", user.id, {}, user);
      else await this.store.insert("CMSUser", user);
      await this.activity(actor, "", "Updated CMS access");
      return user;
    });
  }
}
