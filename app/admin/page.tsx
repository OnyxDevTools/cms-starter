// filename: app/admin/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { all } from "@/lib/cms/service";
import { AdminTable } from "@/admin/table";
export default async function Dashboard() {
  const actor = await requireEditor(),
    service = getCMS(),
    rows = await service.listContent(actor),
    activity = (
      await all(
        service.store,
        "Activity",
        actor.roles.includes("author") ? { actorUid: actor.userId } : {},
        2000,
      )
    )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Workspace / Overview</p>
          <h1>A good day to publish.</h1>
          <p className="muted">
            Shape your next story, refine a draft, or see what’s live.
          </p>
        </div>
        <a className="button" href="/admin/new">
          + New page
        </a>
      </div>
      <section className="stat-grid" aria-label="Content totals">
        {[
          {
            label: "Published",
            value: rows.filter((r) => r.status.startsWith("Published")).length,
            note: "Out in the world",
            className: "stat-blue",
          },
          {
            label: "Drafts",
            value: rows.filter((r) => r.status === "Draft").length,
            note: "Ideas taking shape",
            className: "stat-yellow",
          },
          {
            label: "All content",
            value: rows.length,
            note: "Your growing library",
            className: "stat-neutral",
          },
        ].map((item) => (
          <article key={item.label} className={`stat-card ${item.className}`}>
            <p>{item.label}</p>
            <strong>{item.value.toString().padStart(2, "0")}</strong>
            <span>{item.note}</span>
          </article>
        ))}
      </section>
      <section className="section-heading">
        <h2>On your desk</h2>
        <a href="/admin/content">View all content →</a>
      </section>
      <AdminTable
        rows={rows
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 6)}
        fields={[
          { key: "title", label: "Title" },
          { key: "kind", label: "Type" },
          { key: "status", label: "Status" },
          { key: "updatedAt", label: "Updated" },
        ]}
      />
      <section className="panel activity-panel">
        <h2>Recent activity</h2>
        {activity.length ? (
          activity.map((event) => (
            <div key={event.id} className="activity-row">
              <span className="activity-dot" />
              <p>
                {event.action}
                <small>
                  {event.actorName} ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </small>
              </p>
              {event.pageId && <a href={`/admin/${event.pageId}`}>Open ↗</a>}
            </div>
          ))
        ) : (
          <p className="muted">Your first saved draft will appear here.</p>
        )}
      </section>
    </>
  );
}
