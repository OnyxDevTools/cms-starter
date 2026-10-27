// filename: scripts/seed.ts
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Publishing } from "../lib/publication";
import { OnyxStore } from "../lib/repository";
import type { Document, RevisionInputType, ContentNode } from "../lib/domain";

export function seedId(path: string) {
  const h = createHash("sha256")
    .update(`cms-starter:${path}`)
    .digest("hex")
    .slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20)}`;
}
const paragraph = (text: string): ContentNode => ({
  type: "paragraph",
  version: 1,
  children: [{ type: "text", version: 1, text, format: 0 }],
});
const heading = (text: string): ContentNode => ({
  type: "heading",
  tag: "h2",
  version: 1,
  children: [{ type: "text", version: 1, text, format: 0 }],
});
const document = (text: string): Document => ({
  version: 1,
  root: {
    type: "root",
    version: 1,
    children: [
      paragraph(text),
      heading("A clear foundation"),
      paragraph(
        "Start with useful information, a readable structure, and room to grow. Every page here is rendered on the server, with a stable address and a clear purpose.",
      ),
      heading("Make it your own"),
      paragraph(
        "Use this space for your own ideas. Keep what helps your readers, remove what does not, and build from a small, dependable foundation.",
      ),
    ],
  },
});
export const examples: {
  path: string;
  title: string;
  summary: string;
  layout: RevisionInputType["layout"];
  body: string;
}[] = [
  {
    path: "/",
    title: "A clear place to start.",
    summary:
      "Thoughtful pages, useful resources, and a foundation built to grow with your ideas.",
    layout: "home",
    body: "A good website begins with clarity. This is a small collection of pages and resources designed to be useful from the first visit.",
  },
  {
    path: "/about",
    title: "Simple. Useful. Considered.",
    summary:
      "A flexible starting point for sharing information with care and purpose.",
    layout: "content",
    body: "This space is intentionally neutral. It gives your content a clear structure without deciding what your work should be about.",
  },
  {
    path: "/resources",
    title: "A small library of useful ideas.",
    summary:
      "Practical starting points, considered guidance, and ideas worth returning to.",
    layout: "collection",
    body: "Browse a collection of short resources. Each has its own address, readable structure, and room for your perspective.",
  },
  {
    path: "/resources/example",
    title: "Begin with a clear purpose.",
    summary: "A practical guide to giving every page a useful role.",
    layout: "detail",
    body: "Before adding a page, ask what a visitor should understand or do after reading it. A clear purpose makes every other decision easier.",
  },
  {
    path: "/resources/structure",
    title: "Create a useful structure.",
    summary: "Keep the path through your content simple and predictable.",
    layout: "detail",
    body: "Headings, short paragraphs, and useful links help people find their way. A thoughtful structure works well on a small screen and without JavaScript.",
  },
  {
    path: "/resources/checklist",
    title: "Review the essentials.",
    summary: "A short checklist for clear and accessible information.",
    layout: "detail",
    body: "Review your title, summary, links, and image descriptions. Publish a complete revision so visitors receive the content you intended.",
  },
];
const project = JSON.parse(
  readFileSync(new URL("../project.json", import.meta.url), "utf8"),
) as { name: string };
export async function seed(service: Publishing) {
  const now = new Date().toISOString();
  if (!(await service.store.get("SiteSettings", "site")))
    await service.store.insert("SiteSettings", {
      id: "site",
      name: project.name,
      description: "Clear information, thoughtful structure, and room to grow.",
      origin: "https://example.test",
      organizationName: "",
      organizationURL: "",
      logoMediaId: "",
      socialMediaId: "",
      footerText: "Independent stories. Thoughtfully published.",
      updatedAt: now,
    });
  const termId = seedId("category:perspectives");
  if (!(await service.store.get("Taxonomy", termId)))
    await service.store.insert("Taxonomy", {
      id: termId,
      kind: "category",
      name: "Perspectives",
      slug: "perspectives",
      description: "Clear ideas and useful foundations.",
      archived: false,
      updatedAt: now,
    });
  for (const example of examples) {
    const pageId = seedId(example.path);
    const existing = await service.store.get("Route", example.path);
    if (existing && existing.pageId !== pageId) continue;
    if (await service.store.get("Page", pageId)) continue;
    await service.claim(example.path, pageId);
    const input: RevisionInputType = {
      ...example,
      contentType: example.layout === "detail" ? "post" : "page",
      authorName: "Editorial team",
      actorUid: "seed",
      action: "seed",
      publishedAt: now,
      canonicalPath: "",
      socialMediaId: "",
      terms: example.layout === "detail" ? termId : "",
      seoTitle: "",
      seoDescription: "",
      indexable: true,
      heroMediaId: "",
      toc: example.layout !== "home",
      document: document(example.body),
    };
    if (example.path === "/resources/example") {
      const mediaId = seedId("media:editorial-study");
      if (!(await service.store.get("Media", mediaId))) {
        const pixels = Buffer.alloc(960 * 640 * 3);
        for (let y = 0; y < 640; y++)
          for (let x = 0; x < 960; x++) {
            const at = (y * 960 + x) * 3,
              band = (x + y * 0.6) % 260 < 130;
            pixels[at] = band ? 38 : 225;
            pixels[at + 1] = band ? 76 : 232;
            pixels[at + 2] = band ? 206 : 252;
          }
        const bytes = await sharp(pixels, {
          raw: { width: 960, height: 640, channels: 3 },
        })
          .png()
          .toBuffer();
        await service.store.saveDocument(mediaId, "image/png", bytes);
        await service.store.insert("Media", {
          id: mediaId,
          documentId: mediaId,
          ownerPageId: pageId,
          ownerUid: "seed",
          name: "editorial-study.png",
          caption: "A study in cobalt and paper.",
          deleted: false,
          width: 960,
          height: 640,
          mime: "image/png",
          alt: "Diagonal cobalt stripes across a pale paper background",
          createdAt: now,
        });
      }
      input.heroMediaId = mediaId;
    }
    // Deterministic page identity makes an interrupted seed recoverable by an
    // operator; insert-only writes never replace an existing user's content.
    const snapshot = await service.snapshot(input, pageId);
    const page = {
      id: pageId,
      ownerUid: "seed",
      archived: false,
      path: example.path,
      draftRevisionId: snapshot.id,
      publishedRevisionId: "",
      previousPublishedRevisionId: "",
      editToken: seedId(`edit:${example.path}`),
      publicationToken: seedId(`publication:${example.path}`),
      createdAt: now,
      updatedAt: now,
    };
    await service.store.insert("Page", page);
    await service.publish(pageId, page.editToken, page.publicationToken);
  }
  const draftId = seedId("/unpublished-notes");
  if (
    !(await service.store.get("Page", draftId)) &&
    !(await service.store.get("Route", "/unpublished-notes"))
  ) {
    await service.claim("/unpublished-notes", draftId);
    const revision = await service.snapshot(
      {
        path: "/unpublished-notes",
        title: "An idea still taking shape",
        summary: "A private sample draft for the editorial team.",
        layout: "content",
        contentType: "page",
        seoTitle: "",
        seoDescription: "",
        indexable: true,
        heroMediaId: "",
        toc: false,
        document: document(
          "This content is a draft. It must never appear on the public website until an editor publishes it.",
        ),
      },
      draftId,
    );
    await service.store.insert("Page", {
      id: draftId,
      ownerUid: "seed",
      archived: false,
      path: "/unpublished-notes",
      draftRevisionId: revision.id,
      publishedRevisionId: "",
      previousPublishedRevisionId: "",
      editToken: seedId("draft-edit"),
      publicationToken: seedId("draft-publication"),
      createdAt: now,
      updatedAt: now,
    });
  }
  const links = [
    { location: "header" as const, label: "Home", path: "/" },
    { location: "header" as const, label: "About", path: "/about" },
    { location: "header" as const, label: "Resources", path: "/resources" },
    { location: "footer" as const, label: "About", path: "/about" },
    { location: "footer" as const, label: "Resources", path: "/resources" },
  ];
  for (const [position, link] of links.entries()) {
    const id = `nav-${position}`;
    if (!(await service.store.get("NavigationLink", id)))
      await service.store.insert("NavigationLink", {
        id,
        ...link,
        pageId: seedId(link.path),
        position,
        enabled: true,
      });
  }
}
if (process.argv[1]?.endsWith("seed.ts")) {
  await seed(new Publishing(new OnyxStore()));
  console.log("Seed completed without overwriting existing records.");
}
