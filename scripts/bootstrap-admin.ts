// filename: scripts/bootstrap-admin.ts
import { AppError } from "../lib/domain";
import { firebaseAdmin } from "../lib/auth/admin";
import { OnyxStore } from "../lib/repository";
import { CMS, all } from "../lib/cms/service";
const email = process.env.CMS_ADMIN_EMAIL;
if (!email)
  throw new Error(
    "Set CMS_ADMIN_EMAIL to an existing verified application Firebase user.",
  );
const user = await firebaseAdmin().getUserByEmail(email);
if (!user.emailVerified || user.disabled)
  throw new Error("Bootstrap requires a verified, active Firebase user.");
const service = new CMS(new OnyxStore());
await service.locked("users", async () => {
  const users = await all(service.store, "CMSUser");
  if (
    users.some(
      (u) => u.active && u.role === "administrator" && u.id !== user.uid,
    )
  )
    throw new AppError(
      409,
      "An administrator already exists. Use authenticated user management to grant further access.",
    );
  const old = await service.store.get("CMSUser", user.uid);
  if (!old)
    await service.store.insert("CMSUser", {
      id: user.uid,
      email: user.email!,
      name: user.displayName || user.email!,
      role: "administrator",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  else if (old.role !== "administrator" || !old.active)
    throw new AppError(
      409,
      "Existing grant requires explicit administrator review.",
    );
});
console.log(
  "Administrator grant is ready. No user password or bypass was created.",
);
