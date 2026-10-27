// filename: app/admin/users/page.tsx
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { role, all } from "@/lib/cms/service";
import { AdminTable } from "@/admin/table";
import { UserForm } from "@/admin/management";
export default async function Users() {
  const actor = await requireEditor();
  role(actor, ["administrator"]);
  const users = await all(getCMS().store, "CMSUser");
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">People & permissions</p>
          <h1>Your editorial team</h1>
        </div>
      </div>
      <AdminTable
        kind="plain"
        rows={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.active ? "Active" : "Disabled",
        }))}
        fields={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          { key: "status", label: "Access" },
        ]}
      />
      <UserForm />
    </>
  );
}
