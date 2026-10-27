// filename: app/admin/revisions/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { all } from "@/lib/cms/service";
import { AdminTable } from "@/admin/table";
export default async function Revisions() {
  const actor = await requireEditor(),
    service = getCMS(),
    pages = await service.listContent(actor),
    items = (
      await Promise.all(
        pages.map((p) =>
          all(service.store, "PageRevision", { pageId: p.id }, 500),
        ),
      )
    )
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">A record of your work</p>
          <h1>Revision history</h1>
          <p className="muted">
            Open an item to restore a revision into a new draft. Live
            publications stay unchanged.
          </p>
        </div>
      </div>
      <AdminTable
        kind="plain"
        rows={items.map((r) => ({
          id: r.id,
          title: r.title,
          action: r.action,
          author: r.authorName,
          updatedAt: r.createdAt,
          href: `/admin/${r.pageId}`,
        }))}
        fields={[
          { key: "title", label: "Content" },
          { key: "action", label: "Action" },
          { key: "author", label: "Attribution" },
          { key: "updatedAt", label: "Saved" },
        ]}
      />
    </>
  );
}
