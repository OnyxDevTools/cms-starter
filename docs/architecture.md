# CMS architecture and publication guarantees

CMS Starter derives from the actual SEO Starter Page/Revision/Node/Route model and public SSR components. It remains one Node.js Next.js modular monolith. Public rendering, metadata, navigation, sitemap shards, local fonts, responsive Sharp delivery and performance checks retain the source's architecture. The theme and editorial experience are new.

`lib/publication.ts` remains the publication engine. `lib/cms/service.ts` extends it with policy-enforced CMS operations; Route Handlers do not call unguarded base mutations for user requests. Explicit operator seed commands use the inherited engine with writers stopped. Firebase validates the application identity; Onyx CMSUser rows provide live, revocable role grants. Application Firebase tokens are never passed off as Onyx platform identities.

WorkingDraft/DraftNode hold the latest autosave separately from immutable PageRevision/PageNode history. Complete temporary node sets precede a draft head and edit-token change. Explicit Save and Publish create permanent revision boundaries. Old autosave node sets are cleaned after successful checkpoints; crashes can leave orphans for operator reconciliation. Preview prefers the working head and rechecks the owner/role, while every public projection captures only Page.publishedRevisionId.

Publication completes immutable rows, media/term validation, a Route claim and PublicationPath manifest before changing the live pointer. Old URLs resolve directly to the current canonical revision. PageLock serializes cooperating page writers; media-publication also coordinates publication, global site images and media removal. Tokens reject stale editors inside exclusion. No undocumented CAS, multi-record transaction, distributed exactly-once guarantee or automatic TTL recovery is claimed.

Public reads are dynamic/no-store; React cache only deduplicates within one request. Explicit Next revalidatePath calls invalidate affected layout/derived endpoints, and future reads on all instances consult Onyx. An in-flight request may finish with the captured earlier publication. Navigation/settings saves are explicit and serialized; a multi-row navigation save can be observed partially by an in-flight reader.

Public media checks current eligibility on every delivery, including site logo/social references. Draft delivery checks the owning page and active session/grant. No private media enters Next's shared image optimizer. Removal blocks current public references and tombstones the library record; stored bytes and historical revisions remain until an operator's retention process.

The public bundle must exclude Lexical/table editor code, admin forms, Firebase Admin and Onyx SDKs. The copied static React document renderer remains aligned with the shared allowlist and flattened typed nodes. No accepted HTML/JSX/MDX execution or arbitrary embeds exist. Rich-text and public component changes must update validation, persistence and rendering together.

This is a small single-site starter. Authorized listings and public discovery have explicit scan budgets, not unlimited full-table queries. Add suitable indexed projections/search and provider-supported transactional primitives before increasing scale or concurrency.
