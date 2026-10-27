// filename: app/preview/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { AppError } from "@/lib/domain";
import { Locked } from "@/admin/locked";
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { Publication } from "@/components/publication";
import { PublicShell } from "@/components/shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Private draft preview",
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let actor, snapshot, error: unknown;
  const service = getCMS();
  try {
    actor = await requireEditor();
    snapshot = await service.draft(actor, (await params).id);
  } catch (e) {
    error = e;
  }
  if (error instanceof AppError && error.status === 401) redirect("/sign-in");
  if (
    error instanceof AppError &&
    (error.status === 403 || error.status === 404)
  )
    notFound();
  if (!snapshot) return <Locked error={error} />;
  const { page, revision, document } = snapshot;
  const site = await service.settings();
  return (
    <>
      <div className="preview-banner" role="status">
        Private draft preview · not published
        <a href={`/admin/${page.id}`}>Exit preview / Back to editor →</a>
      </div>
      <PublicShell>
        <Publication
          revision={revision}
          document={document}
          site={site}
          preview
        />
      </PublicShell>
    </>
  );
}
