// filename: app/(public)/search/page.tsx
import { publicEntries } from "@/lib/cms/public";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams).q || "").trim().slice(0, 120),
    rows = query
      ? (await publicEntries())
          .filter((item) =>
            (
              item.revision.title +
              " " +
              item.revision.summary +
              " " +
              item.terms
            )
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 50)
      : [];
  return (
    <main id="main" className="container page-header">
      <p className="eyebrow">Find your next read</p>
      <h1>Search the journal.</h1>
      <form action="/search" className="button-row">
        <label className="field">
          Search
          <input name="q" defaultValue={query} maxLength={120} />
        </label>
        <button className="button">Search</button>
      </form>
      {query && <p>{rows.length} matching publications</p>}
      <div className="card-grid">
        {rows.map(({ page, revision }) => (
          <article className="card" key={page.id}>
            <h2>
              <a href={revision.path}>{revision.title}</a>
            </h2>
            <p>{revision.summary}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
