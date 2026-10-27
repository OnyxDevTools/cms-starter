// filename: lib/domain.ts
import { z } from "zod";
import type { OnyxSchema } from "./onyx/generated";
type CheckedRows<T extends OnyxSchema> = T;

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function normalizePath(input: string): string {
  let path = input.trim().normalize("NFC");
  if (
    !path.startsWith("/") ||
    path.includes("//") ||
    Array.from(path).some(
      (c) =>
        c.charCodeAt(0) <= 32 ||
        ["?", "#", String.fromCharCode(92), "%"].includes(c),
    )
  )
    throw new AppError(
      422,
      "Use a root-relative path without encoded characters, query, or fragment.",
    );
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  path = path.toLowerCase();
  if (path.length > 180 || path.split("/").some((c) => c === "." || c === ".."))
    throw new AppError(422, "Invalid page path.");
  if (
    [
      "admin",
      "api",
      "preview",
      "media",
      "_next",
      "sitemaps",
      "sign-in",
      "sign-up",
      "verify-email",
      "search",
      "feed.xml",
    ].includes(path.split("/")[1]) ||
    ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/og.png"].includes(path)
  )
    throw new AppError(422, "That path is reserved.");
  return path;
}
export function safeURL(input: string): string {
  if (
    Array.from(input).some(
      (c) => c.charCodeAt(0) <= 32 || c === String.fromCharCode(92),
    ) ||
    input.startsWith("//")
  )
    throw new AppError(422, "Unsafe link.");
  if (input.startsWith("#")) return input;
  if (input.startsWith("/")) {
    normalizePath(input.split(/[?#]/u)[0]);
    return input;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError(422, "Invalid link.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new AppError(422, "Only HTTP(S) or local links are allowed.");
  return input;
}
export const pathSchema = z.string().transform(normalizePath);
export const originSchema = z
  .string()
  .url()
  .transform((value) => {
    const u = new URL(value);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash
    )
      throw new AppError(422, "Canonical origin must be an HTTP(S) origin.");
    return u.origin;
  });
const id = z.string().min(1).max(220);
const stamp = z.iso.datetime();
export const PageSchema = z.object({
  id,
  ownerUid: z.string().default("seed"),
  archived: z.boolean().default(false),
  path: pathSchema,
  draftRevisionId: z.string(),
  publishedRevisionId: z.string(),
  previousPublishedRevisionId: z.string(),
  editToken: z.string(),
  publicationToken: z.string(),
  createdAt: stamp,
  updatedAt: stamp,
});
export const RevisionSchema = z.object({
  id,
  contentType: z.enum(["page", "post"]).default("page"),
  authorName: z.string().max(100).default("Editorial team"),
  actorUid: z.string().max(220).default("seed"),
  action: z.string().max(50).default("save"),
  publishedAt: z
    .string()
    .refine(
      (v) => !v || !Number.isNaN(Date.parse(v)),
      "Invalid publication date",
    )
    .default(""),
  canonicalPath: z
    .string()
    .transform((v) => (v ? normalizePath(v) : ""))
    .default(""),
  socialMediaId: z.string().default(""),
  terms: z
    .string()
    .max(2300)
    .refine(
      (v) =>
        !v ||
        (v.split(",").length <= 20 &&
          v.split(",").every((id) => z.uuid().safeParse(id).success)),
      "Choose up to twenty valid terms",
    )
    .default(""),
  pageId: id,
  path: pathSchema,
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(320),
  layout: z.enum(["home", "content", "collection", "detail"]),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(180),
  indexable: z.boolean(),
  heroMediaId: z.string(),
  toc: z.boolean(),
  documentVersion: z.literal(1),
  createdAt: stamp,
});
export const SiteSchema = z.object({
  id: z.literal("site"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(180),
  origin: originSchema,
  organizationName: z.string().max(120),
  organizationURL: z.string().max(200),
  logoMediaId: z.string().default(""),
  socialMediaId: z.string().default(""),
  footerText: z
    .string()
    .max(500)
    .default("A clear foundation. Room to make it yours."),
  updatedAt: stamp,
});
export const NavigationSchema = z.object({
  id,
  pageId: z.string().default(""),
  position: z.number().int().min(0),
  location: z.enum(["header", "footer"]),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(50),
  path: pathSchema,
});
export const RouteSchema = z.object({
  id: pathSchema,
  pageId: id,
  createdAt: stamp,
});
export const PublicationPathSchema = z.object({
  id,
  revisionId: id,
  path: pathSchema,
});
export const MediaSchema = z.object({
  id,
  ownerPageId: id,
  ownerUid: z.string().default("seed"),
  name: z.string().max(120).default("image"),
  caption: z.string().max(500).default(""),
  deleted: z.boolean().default(false),
  documentId: id,
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  alt: z.string().trim().min(1).max(240),
  createdAt: stamp,
});
export const NodeSchema = z.object({
  id,
  revisionId: id,
  parentId: z.string(),
  position: z.number().int(),
  kind: z.string(),
  text: z.string(),
  textFormat: z.number().int(),
  align: z.string(),
  indent: z.number().int(),
  tag: z.string(),
  url: z.string(),
  listType: z.string(),
  start: z.number().int(),
  language: z.string(),
  mediaId: z.string(),
  alt: z.string(),
  headerState: z.number().int().default(0),
  colSpan: z.number().int().default(1),
  rowSpan: z.number().int().default(1),
});
export const LockSchema = z.object({
  id,
  ownerToken: z.string().uuid(),
  createdAt: stamp,
});
export const UserSchema = z.object({
  id,
  email: z.email(),
  name: z.string().min(1).max(80),
  role: z.enum(["administrator", "editor", "author"]),
  active: z.boolean(),
  createdAt: stamp,
  updatedAt: stamp,
});
export const TermSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["category", "tag"]),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  description: z.string().max(500),
  archived: z.boolean(),
  updatedAt: stamp,
});
export const WorkingSchema = RevisionSchema.extend({
  id,
  pageId: id,
  nodeSetId: id,
  updatedAt: stamp,
});
export const ActivitySchema = z.object({
  id,
  pageId: z.string(),
  actorUid: id,
  actorName: z.string(),
  action: z.string(),
  createdAt: stamp,
});
export const schemas = {
  CMSUser: UserSchema,
  Taxonomy: TermSchema,
  WorkingDraft: WorkingSchema,
  DraftNode: NodeSchema,
  Activity: ActivitySchema,
  PageLock: LockSchema,
  Page: PageSchema,
  PageRevision: RevisionSchema,
  PageNode: NodeSchema,
  Route: RouteSchema,
  PublicationPath: PublicationPathSchema,
  SiteSettings: SiteSchema,
  NavigationLink: NavigationSchema,
  Media: MediaSchema,
};
export type Table = keyof typeof schemas;
export type Rows = CheckedRows<{ [K in Table]: z.infer<(typeof schemas)[K]> }>;
export type Page = Rows["Page"];
export type Revision = Rows["PageRevision"];
export type Site = Rows["SiteSettings"];
export type Media = Rows["Media"];

export type ContentNode = {
  type: string;
  version: 1;
  text?: string;
  format?: number | string;
  indent?: number;
  tag?: string;
  url?: string;
  listType?: string;
  start?: number;
  language?: string;
  mediaId?: string;
  alt?: string;
  headerState?: number;
  colSpan?: number;
  rowSpan?: number;
  children?: ContentNode[];
};
const allowed = [
  "root",
  "paragraph",
  "text",
  "heading",
  "list",
  "listitem",
  "link",
  "image",
  "quote",
  "code",
  "code-highlight",
  "linebreak",
  "table",
  "tablerow",
  "tablecell",
] as const;
const tree: z.ZodType<ContentNode> = z.lazy(() =>
  z.object({
    type: z.enum(allowed),
    version: z.literal(1),
    text: z.string().max(20000).optional(),
    format: z
      .union([z.number().int().min(0).max(255), z.string().max(20)])
      .optional(),
    indent: z.number().int().min(0).max(8).optional(),
    tag: z.enum(["h2", "h3", "h4"]).optional(),
    url: z.string().max(500).transform(safeURL).optional(),
    listType: z.enum(["bullet", "number"]).optional(),
    start: z.number().int().min(1).max(1000).optional(),
    language: z.string().max(30).optional(),
    mediaId: z.string().uuid().optional(),
    alt: z.string().max(240).optional(),
    headerState: z.number().int().min(0).max(3).optional(),
    colSpan: z.number().int().min(1).max(10).optional(),
    rowSpan: z.number().int().min(1).max(20).optional(),
    children: z.array(tree).max(128).optional(),
  }),
);
export const DocumentSchema = z
  .object({ version: z.literal(1), root: tree })
  .superRefine((doc, ctx) => {
    let count = 0;
    const visit = (node: ContentNode, depth: number) => {
      count++;
      if (depth > 8)
        ctx.addIssue({
          code: "custom",
          message: "Document nesting exceeds eight levels.",
        });
      if (node.type === "image" && (!node.mediaId || !node.alt?.trim()))
        ctx.addIssue({
          code: "custom",
          message: "Images need a media ID and alt text.",
        });
      if (node.type === "link" && !node.url)
        ctx.addIssue({
          code: "custom",
          message: "Links need a safe destination.",
        });
      for (const child of node.children || []) visit(child, depth + 1);
    };
    if (doc.root.type !== "root")
      ctx.addIssue({
        code: "custom",
        message: "Document requires a root node.",
      });
    const checkStructure = (node: ContentNode, parent = "") => {
      if (node.type === "table" && parent === "tablecell")
        ctx.addIssue({
          code: "custom",
          message: "Nested tables are unsupported.",
        });
      if (
        (node.type === "tablerow" && parent !== "table") ||
        (node.type === "tablecell" && parent !== "tablerow")
      )
        ctx.addIssue({ code: "custom", message: "Invalid table structure." });
      if (
        (node.type === "table" &&
          node.children?.some((n) => n.type !== "tablerow")) ||
        (node.type === "tablerow" &&
          node.children?.some((n) => n.type !== "tablecell"))
      )
        ctx.addIssue({ code: "custom", message: "Invalid table children." });
      node.children?.forEach((child) => checkStructure(child, node.type));
    };
    checkStructure(doc.root);
    visit(doc.root, 0);
    if (count > 256)
      ctx.addIssue({
        code: "custom",
        message: "Documents support at most 256 nodes.",
      });
  });
export type Document = z.infer<typeof DocumentSchema>;
export const RevisionInput = RevisionSchema.omit({
  id: true,
  pageId: true,
  createdAt: true,
  documentVersion: true,
}).extend({ document: DocumentSchema });
export type RevisionInputType = Omit<
  z.input<typeof RevisionInput>,
  "document"
> & { document: Document };
export function flatten(
  revisionId: string,
  document: Document,
): Rows["PageNode"][] {
  const rows: Rows["PageNode"][] = [];
  const visit = (node: ContentNode, parentId: string) => {
    const position = rows.length;
    const id = `${revisionId}:${position}`;
    rows.push({
      id,
      revisionId,
      parentId,
      position,
      kind: node.type,
      text: node.text || "",
      textFormat: typeof node.format === "number" ? node.format : 0,
      align: typeof node.format === "string" ? node.format : "",
      indent: node.indent || 0,
      tag: node.tag || "",
      url: node.url || "",
      listType: node.listType || "",
      start: node.start || 1,
      language: node.language || "",
      mediaId: node.mediaId || "",
      alt: node.alt || "",
      headerState: node.headerState || 0,
      colSpan: node.colSpan || 1,
      rowSpan: node.rowSpan || 1,
    });
    for (const child of node.children || []) visit(child, id);
  };
  visit(document.root, "");
  return rows;
}
export function inflate(rows: Rows["PageNode"][]): Document {
  const nodes = new Map<string, ContentNode>();
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  for (const row of sorted)
    nodes.set(row.id, {
      type: row.kind,
      version: 1,
      text: row.text,
      format:
        row.kind === "text" || row.kind === "code-highlight"
          ? row.textFormat
          : row.align,
      indent: row.indent,
      ...(row.tag ? { tag: row.tag } : {}),
      ...(row.url ? { url: row.url } : {}),
      ...(row.listType ? { listType: row.listType } : {}),
      start: row.start,
      ...(row.language ? { language: row.language } : {}),
      ...(row.mediaId ? { mediaId: row.mediaId } : {}),
      ...(row.alt ? { alt: row.alt } : {}),
      headerState: row.headerState,
      colSpan: row.colSpan,
      rowSpan: row.rowSpan,
      children: [],
    });
  let root: ContentNode | undefined;
  for (const row of sorted) {
    const node = nodes.get(row.id)!;
    if (row.parentId) {
      const parent = nodes.get(row.parentId);
      if (!parent) throw new AppError(500, "Invalid content tree.");
      parent.children!.push(node);
    } else if (root) {
      throw new AppError(500, "Invalid content root.");
    } else root = node;
  }
  return DocumentSchema.parse({ version: 1, root });
}
export function textContent(node: ContentNode): string {
  return node.text || node.children?.map(textContent).join("") || "";
}
export function headings(doc: Document) {
  const result: { id: string; text: string; level: string }[] = [];
  let index = 0;
  const walk = (node: ContentNode) => {
    if (node.type === "heading") {
      result.push({
        id: `section-${++index}`,
        text: textContent(node),
        level: node.tag || "h2",
      });
    }
    node.children?.forEach(walk);
  };
  walk(doc.root);
  return result;
}
export function isPublic(page: Page) {
  return Boolean(page.publishedRevisionId) && !page.archived;
}
export function isIndexable(page: Page, revision: Revision) {
  return isPublic(page) && revision.indexable;
}
export function jsonLD(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function canonical(site: Site, path: string, page = 1) {
  const url = new URL(normalizePath(path), site.origin);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}
