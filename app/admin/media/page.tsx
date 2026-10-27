// filename: app/admin/media/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { AdminTable } from "@/admin/table";
import { MediaForm } from "@/admin/management";
export default async function Media({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await requireEditor(),
    service = getCMS(),
    rows = await service.mediaList(actor),
    pages = await service.listContent(actor),
    id = (await searchParams).id,
    selected = rows.find((m) => m.id === id) || null;
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Your visual library</p>
          <h1>Media</h1>
          <p className="muted">
            Private until referenced by a publication or public site setting.
          </p>
        </div>
        <a className="button" href="/admin/media">
          + Upload image
        </a>
      </div>
      <AdminTable
        kind="media"
        rows={rows.map((m) => ({
          id: m.id,
          name: m.name,
          alt: m.alt,
          visibility: m.visibility,
          usage: m.usage,
          dimensions: `${m.width} × ${m.height}`,
        }))}
        filterField="visibility"
        fields={[
          { key: "name", label: "File" },
          { key: "alt", label: "Alt text" },
          { key: "dimensions", label: "Dimensions" },
          { key: "visibility", label: "Visibility" },
          { key: "usage", label: "Owned by" },
        ]}
      />
      <MediaForm
        key={selected?.id || "new"}
        selected={selected}
        canDelete={!actor.roles.includes("author")}
        canEdit={
          !actor.roles.includes("author") || selected?.visibility !== "Public"
        }
        pages={pages.filter((p) => p.status !== "Archived")}
      />
    </>
  );
}
