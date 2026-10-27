// filename: app/(public)/[[...slug]]/page.tsx
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicPage, getSite } from "@/lib/server";
import { AppError, normalizePath } from "@/lib/domain";
import { metadata } from "@/lib/seo";
import { Publication } from "@/components/publication";

type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string }>;
};
async function resolve(props: Props) {
  const [{ slug }, search] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  let path: string;
  try {
    path = normalizePath("/" + (slug || []).join("/"));
  } catch (error) {
    if (error instanceof AppError && error.status === 422) notFound();
    throw error;
  }
  const raw = "/" + (slug || []).join("/");
  if (raw !== path)
    permanentRedirect(
      path + (search.page ? `?page=${encodeURIComponent(search.page)}` : ""),
    );
  const snapshot = await getPublicPage(path);
  if (!snapshot) notFound();
  if (snapshot.redirect) permanentRedirect(snapshot.redirect);
  const page = search.page ? Number(search.page) : 1;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100 ||
    (search.page && snapshot.revision.layout !== "collection")
  )
    notFound();
  if (search.page === "1") permanentRedirect(path);
  return { ...snapshot, pageNumber: page };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const [snapshot, site] = await Promise.all([resolve(props), getSite()]);
  return metadata(site, snapshot.revision, snapshot.pageNumber);
}
export default async function Page(props: Props) {
  const [snapshot, site] = await Promise.all([resolve(props), getSite()]);
  return (
    <Publication
      revision={snapshot.revision}
      document={snapshot.document}
      site={site}
      pageNumber={snapshot.pageNumber}
    />
  );
}
