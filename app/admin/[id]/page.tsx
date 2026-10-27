// filename: app/admin/[id]/page.tsx
import { z } from "zod";
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { PageForm } from "@/admin/page-form";
import { all } from "@/lib/cms/service";
export default async function Edit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const actor = await requireEditor(),
    { id } = await params,
    service = getCMS(),
    terms = await service.terms(actor),
    canPublish = actor.roles.some(
      (r) => r === "administrator" || r === "editor",
    );
  if (id === "new")
    return (
      <>
        <div className="page-title">
          <div>
            <p className="eyebrow">Content / New draft</p>
            <h1>Make something worth reading.</h1>
          </div>
        </div>
        <PageForm
          initial={null}
          snapshot={null}
          media={[]}
          terms={terms}
          revisions={[]}
          canPublish={canPublish}
          kind={(await searchParams).kind === "post" ? "post" : "page"}
        />
      </>
    );
  z.uuid().parse(id);
  const snapshot = await service.draft(actor, id),
    media = await all(
      service.store,
      "Media",
      { ownerPageId: id, deleted: false },
      100,
    ),
    revisions = (
      await all(service.store, "PageRevision", { pageId: id }, 500)
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-title">
        <div>
          <a className="eyebrow" href="/admin/content">
            ← Content library
          </a>
          <h1>{snapshot.revision.title}</h1>
        </div>
        <a href={`/preview/${id}`} target="_blank" rel="noopener noreferrer">
          Preview ↗
        </a>
      </div>
      <PageForm
        key={snapshot.page.editToken}
        initial={snapshot.page}
        snapshot={snapshot}
        media={media}
        terms={terms}
        revisions={revisions}
        canPublish={canPublish}
      />
    </>
  );
}
