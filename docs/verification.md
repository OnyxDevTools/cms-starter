# Verification

Verified October 27, 2026, using Node 24.22.1 and the production Next.js build.

| Check                                                    | Result                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ESLint, strict TypeScript, formatting                    | Passed                                                                                 |
| Vitest                                                   | 18 tests passed                                                                        |
| Desktop/mobile Playwright                                | 14 tests passed                                                                        |
| Production build                                         | Passed                                                                                 |
| Local schema validation and generated-type compatibility | Passed                                                                                 |
| Production dependency audit                              | Zero known vulnerabilities                                                             |
| Public bundle isolation                                  | Nine client outputs; editor/admin/Onyx modules excluded                                |
| Lighthouse                                               | Performance 97–99; accessibility, best practices and SEO 100 on all four public routes |
| Independent clean-copy smoke                             | Fresh install, rename, check/build and 14 browser checks passed                        |

The inherited publication tests remain. CMS tests cover independent working/saved/public snapshots, autosaves without permanent revision creation, stale edit tokens, role/owner scope, route collisions and publication redirects, revision restoration, archive/unpublish, administrator safeguards, cloned media ownership, published-image removal checks, unsafe links/nodes/tables and authorization before private revision-node reads.

Browser coverage uses the official Firebase Auth Emulator, verified test identities/grants and an explicit local HTTP transport exercised through the official Onyx SDK. It checks draft creation, autosave/reload, rich-text table insertion, authenticated preview, publication and republishing, unchanged live content during edits, URL redirects, restoration, unpublishing, media upload/private delivery, forbidden removal of published assets, SVG rejection, valid author publish denials, author restrictions on public-media metadata, local publication-date editing, archived read-only content, cross-author requests, public HTML metadata, no-JavaScript browsing, noindex/sitemaps, accessibility and mobile account controls.

Public and preview layouts share `components/publication.tsx`, the inherited content renderer, image components and public shell. Private reads remain authorized on every request; a preview cookie/noindex is never treated as permission.

## Limits

No live Onyx database or production Firebase project was used. Real schema publication, production key permissions, administrator bootstrap against real accounts and external persistence durability require your authorized configuration. The test transport is temporary in-memory data under tests only; the application never selects it as a fallback. An intentionally anonymous request may produce a Next server authorization diagnostic; no private content is returned.

Onyx multi-record transactions/CAS are not assumed. Unknown failures retain locks and may require operator reconciliation with all writers stopped. Listings are bounded for a small single website. Media removal is a delivery-revoking tombstone; retention/purge, scheduling, collaborative merging and larger indexed projections are extension points, not claimed functionality.

These checks performed no live schema publication, cloud catalog change or deployment. The original seo-starter remains unchanged.
