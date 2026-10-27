// filename: app/admin/taxonomy/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { AdminTable } from "@/admin/table";
import { TaxonomyForm } from "@/admin/management";
export default async function Taxonomy({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await requireEditor(),
    terms = await getCMS().terms(actor),
    id = (await searchParams).id,
    initial = terms.find((t) => t.id === id) || null;
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Content organization</p>
          <h1>Categories & tags</h1>
        </div>
        <a className="button" href="/admin/taxonomy">
          + New term
        </a>
      </div>
      <AdminTable
        kind="plain"
        rows={terms.map((t) => ({
          id: t.id,
          name: t.name,
          kind: t.kind,
          slug: t.slug,
          status: t.archived ? "Archived" : "Active",
          href: `/admin/taxonomy?id=${t.id}`,
        }))}
        filterField="kind"
        fields={[
          { key: "name", label: "Name" },
          { key: "kind", label: "Type" },
          { key: "slug", label: "Slug" },
          { key: "status", label: "Status" },
        ]}
      />
      <TaxonomyForm
        key={initial?.id || "new"}
        initial={initial}
        canEdit={!actor.roles.includes("author")}
      />
    </>
  );
}
