// filename: app/admin/content/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { AdminTable } from "@/admin/table";
export default async function Content({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const actor = await requireEditor(),
    kind = (await searchParams).kind,
    rows = (await getCMS().listContent(actor)).filter(
      (r) => !kind || r.kind === kind,
    );
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Content library</p>
          <h1>
            {kind === "post"
              ? "Posts"
              : kind === "page"
                ? "Pages"
                : "All content"}
          </h1>
          <p className="muted">
            Search, sort, and manage every publication and draft.
          </p>
        </div>
        <a
          className="button"
          href={`/admin/new?kind=${kind === "post" ? "post" : "page"}`}
        >
          + Create {kind === "post" ? "post" : "page"}
        </a>
      </div>
      <AdminTable
        rows={rows}
        filterField="status"
        fields={[
          { key: "title", label: "Title" },
          { key: "path", label: "Path" },
          { key: "status", label: "Status" },
          { key: "author", label: "Author" },
          { key: "updatedAt", label: "Updated" },
        ]}
      />
    </>
  );
}
