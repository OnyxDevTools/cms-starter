// filename: app/admin/navigation/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { role } from "@/lib/cms/service";
import { NavigationForm } from "@/admin/management";
export default async function Navigation() {
  const actor = await requireEditor();
  role(actor, ["administrator", "editor"]);
  const service = getCMS();
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Help readers find their way</p>
          <h1>Navigation</h1>
        </div>
      </div>
      <NavigationForm
        initial={await service.navigation()}
        pages={await service.listContent(actor)}
      />
    </>
  );
}
