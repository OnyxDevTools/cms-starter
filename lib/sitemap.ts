// filename: lib/sitemap.ts
export function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export function sitemapResponse(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
export function index(origin: string, prefix = "") {
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${"0123456789abcdef"
    .split("")
    .map(
      (char) =>
        `<sitemap><loc>${xml(new URL(`/sitemaps/${prefix}${char}.xml`, origin).href)}</loc></sitemap>`,
    )
    .join("")}</sitemapindex>`;
}
