# CMS Starter engineering rules

Derived from seo-starter. Read README.md and docs/architecture.md. This project intentionally extends the original editor into a CMS; the original SEO starter remains unchanged.

- Keep one Node.js Next.js application. Reuse lib/domain.ts, repository.ts, publication.ts and the public rendering/SEO pipeline. No external CMS, extra database or hosting adapter.
- Public content, canonical metadata, navigation and JSON-LD remain server-rendered. Public bundles must exclude Lexical, administration, Firebase Admin and the Onyx SDK. Keep local fonts, responsive image dimensions and inherited performance thresholds.
- Reuse the existing Lexical editor and typed PageNode representation, extending editor/server/static-renderer schemas together. Never store executable HTML, JSX, MDX or scripts. Do not add a competing editor.
- Verify Firebase sessions and active Onyx user grants on every private operation. Administrator manages users/settings; editors manage/publish content; authors edit only their own drafts. Never trust client roles or a preview cookie as authorization.
- Keep working drafts separate from immutable saved revisions and the published pointer. All cooperating page mutations acquire insert-only PageLock; reject stale edit tokens. Retain locks after uncertain writes; no automatic lock stealing or CAS claims.
- Publish complete snapshots and path manifests before the live pointer. Keep private/draft media out of public reads, search and sitemaps. Public navigation resolves published content references.
- Use the official Onyx SDK's downloaded-config resolver. Never initialize schemas, seed or bootstrap identities during app startup. No runtime memory fallback or auth bypass; test transports belong under tests only.
- Use Zod for runtime boundaries, strict TypeScript, bounded queries/body sizes/documents, same-origin mutations and safe errors. Keep filename comments after directive prologues. No JSON comments.
- Run npm run check, relevant browser tests, analyze/bundle:check and perf. Report mocked versus live integration evidence. Do not publish, push, deploy, or commit without a later explicit user request.
