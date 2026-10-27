// filename: app/admin/settings/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { role } from "@/lib/cms/service";
import { SiteForm } from "@/admin/management";
export default async function Settings() {
  const actor = await requireEditor();
  role(actor, ["administrator"]);
  const service = getCMS();
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Make it your own</p>
          <h1>Site settings</h1>
        </div>
      </div>
      <SiteForm
        site={await service.settings()}
        media={await service.mediaList(actor)}
      />
    </>
  );
}
