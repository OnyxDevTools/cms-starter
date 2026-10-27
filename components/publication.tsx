// filename: components/publication.tsx
import { notFound } from "next/navigation";
import { getService, getPublicPage } from "@/lib/server";
import { jsonLD, type Revision, type Document, type Site } from "@/lib/domain";
import { structuredData } from "@/lib/seo";
import { Content, SiteImage, TableOfContents } from "./content";
export async function Publication({
  revision,
  document,
  site,
  pageNumber = 1,
  preview = false,
}: {
  revision: Revision;
  document: Document;
  site: Site;
  pageNumber?: number;
  preview?: boolean;
}) {
  const service = getService();
  const terms = await Promise.all(
    revision.terms
      .split(",")
      .filter(Boolean)
      .map((id) => service.store.get("Taxonomy", id)),
  );
  const ids = await service.mediaReferences(document, revision.heroMediaId);
  const media = new Map();
  for (const id of ids) {
    const item = await service.store.get("Media", id);
    if (item && !item.deleted && item.ownerPageId === revision.pageId)
      media.set(id, item);
  }
  const collection =
    revision.layout === "collection"
      ? await service.collection(pageNumber)
      : null;
  if (collection && pageNumber > 1 && !collection.items.length) notFound();
  const recent =
    revision.layout === "home" ? await service.collection(1) : null;
  const [about, resources] = await Promise.all([
    getPublicPage("/about"),
    getPublicPage("/resources"),
  ]);
  return (
    <main id="main" className="container">
      {!preview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLD(structuredData(site, revision, pageNumber)),
          }}
        />
      )}
      {revision.layout === "home" ? (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">A thoughtful starting point</p>
              <h1>{revision.title}</h1>
              <p className="lede">{revision.summary}</p>
              <div className="button-row">
                {resources && (
                  <a className="button" href={resources.revision.path}>
                    Explore resources <span aria-hidden="true">↗</span>
                  </a>
                )}
                {about && (
                  <a className="button secondary" href={about.revision.path}>
                    About this space
                  </a>
                )}
              </div>
            </div>
            <div className="foundation-art" aria-hidden="true">
              <div className="art-grid" />
              <div className="art-card">
                <div className="art-dot" />
                <div className="art-line" />
                <div className="art-line" />
                <div className="art-line" />
                <div className="art-line" />
              </div>
            </div>
          </section>
          <section className="section">
            <div className="section-title">
              <h2>Start with the essentials.</h2>
              {resources && (
                <a href={resources.revision.path}>View all resources ↗</a>
              )}
            </div>
            <div className="card-grid">
              {recent?.items.map(
                (item, index) =>
                  item && (
                    <article className="card" key={item.page.id}>
                      <span className="card-number">
                        0{index + 1} / RESOURCE
                      </span>
                      <h3>
                        <a href={item.revision.path}>{item.revision.title}</a>
                      </h3>
                      <p>{item.revision.summary}</p>
                      <a href={item.revision.path}>
                        Read resource <span aria-hidden="true">↗</span>
                      </a>
                    </article>
                  ),
              )}
              <article className="card">
                <span className="card-number">THE FOUNDATION</span>
                <h3>Useful by design.</h3>
                <p>{site.description}</p>
                {about && <a href={about.revision.path}>Our approach ↗</a>}
              </article>
            </div>
          </section>
          <section className="section">
            <Content document={document} media={media} preview={preview} />
          </section>
        </>
      ) : (
        <>
          <header className="page-header">
            <nav aria-label="Breadcrumbs" className="breadcrumbs">
              <ol>
                <li>
                  <a href="/">Home</a>
                </li>
                <li aria-current="page">{revision.title}</li>
              </ol>
            </nav>
            <p className="eyebrow">
              {revision.layout === "collection"
                ? "The resource library"
                : "Notes & perspectives"}
            </p>
            <h1>
              {revision.title}
              {pageNumber > 1 ? ` — Page ${pageNumber}` : ""}
            </h1>
            <p className="lede">{revision.summary}</p>
            {revision.contentType === "post" && (
              <div className="post-meta">
                <span>By {revision.authorName}</span>
                <time dateTime={revision.publishedAt || revision.createdAt}>
                  {new Date(
                    revision.publishedAt || revision.createdAt,
                  ).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
                {terms
                  .filter((term) => !!term)
                  .map((term) => (
                    <a
                      key={term!.id}
                      href={`/search?q=${encodeURIComponent(term!.name)}`}
                    >
                      {term!.name}
                    </a>
                  ))}
              </div>
            )}
          </header>
          {revision.heroMediaId && media.has(revision.heroMediaId) && (
            <SiteImage
              media={media.get(revision.heroMediaId)!}
              priority
              privateAsset={preview}
            />
          )}
          <div className="article-layout">
            <Content document={document} media={media} preview={preview} />
            {revision.toc && <TableOfContents document={document} />}
          </div>
          {collection && (
            <>
              <div className="card-grid">
                {collection.items.map(
                  (item) =>
                    item && (
                      <article className="card" key={item.page.id}>
                        <p className="eyebrow">Resource</p>
                        <h2>
                          <a href={item.revision.path}>{item.revision.title}</a>
                        </h2>
                        <p>{item.revision.summary}</p>
                        <a href={item.revision.path}>Read resource ↗</a>
                      </article>
                    ),
                )}
              </div>
              <nav className="pagination" aria-label="Resource pagination">
                {pageNumber > 1 ? (
                  <a
                    href={
                      pageNumber === 2
                        ? revision.path
                        : `${revision.path}?page=${pageNumber - 1}`
                    }
                  >
                    ← Previous page
                  </a>
                ) : (
                  <span />
                )}
                <span>Page {pageNumber}</span>
                {collection.hasNext ? (
                  <a href={`${revision.path}?page=${pageNumber + 1}`}>
                    Next page →
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            </>
          )}
        </>
      )}
    </main>
  );
}
