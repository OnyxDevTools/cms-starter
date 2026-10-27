// filename: lib/seo.ts
import type { Metadata } from "next";
import { canonical, type Revision, type Site } from "./domain";
export function metadata(site: Site, revision: Revision, page = 1): Metadata {
  const title = `${revision.seoTitle || revision.title}${page > 1 ? ` — Page ${page}` : ""} | ${site.name}`;
  const description =
    revision.seoDescription || revision.summary || site.description;
  const url = canonical(site, revision.canonicalPath || revision.path, page);
  return {
    title,
    description,
    metadataBase: new URL(site.origin),
    alternates: { canonical: url },
    robots: { index: revision.indexable, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: site.name,
      images: [
        {
          url: new URL(
            revision.socialMediaId
              ? `/media/${revision.socialMediaId}?w=960`
              : site.socialMediaId
                ? `/media/${site.socialMediaId}?w=960`
                : "/og.png",
            site.origin,
          ).href,
          width: 1200,
          height: 630,
          alt: site.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        new URL(
          revision.socialMediaId
            ? `/media/${revision.socialMediaId}?w=960`
            : site.socialMediaId
              ? `/media/${site.socialMediaId}?w=960`
              : "/og.png",
          site.origin,
        ).href,
      ],
    },
  };
}
export function structuredData(site: Site, revision: Revision, page = 1) {
  const url = canonical(site, revision.path, page);
  const data: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type":
        revision.contentType === "post"
          ? "Article"
          : revision.layout === "collection"
            ? "CollectionPage"
            : "WebPage",
      ...(revision.contentType === "post"
        ? {
            author: { "@type": "Person", name: revision.authorName },
            datePublished: revision.publishedAt || revision.createdAt,
          }
        : {}),
      "@id": url,
      url,
      name: revision.title,
      description: revision.summary,
      dateModified: revision.createdAt,
      isPartOf: { "@type": "WebSite", name: site.name, url: site.origin },
    },
  ];
  if (revision.path !== "/")
    data.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: site.name,
          item: site.origin,
        },
        { "@type": "ListItem", position: 2, name: revision.title, item: url },
      ],
    });
  if (revision.path === "/" && site.organizationName && site.organizationURL)
    data.push({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: site.organizationName,
      url: site.organizationURL,
    });
  return data;
}
