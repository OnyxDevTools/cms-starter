// filename: app/admin/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth";
import { AppError } from "@/lib/domain";
import { Locked } from "@/admin/locked";
import { SignOut } from "@/admin/sign-out";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Editorial desk · CMS Starter",
  robots: { index: false, follow: false },
};
export default async function Layout({ children }: { children: ReactNode }) {
  let actor, error: unknown;
  try {
    actor = await requireEditor();
  } catch (e) {
    error = e;
  }
  if (error instanceof AppError && error.status === 401) redirect("/sign-in");
  if (!actor) return <Locked error={error} />;
  const nav = [
    { href: "/admin", name: "Overview", symbol: "◈" },
    { href: "/admin/content?kind=page", name: "Pages", symbol: "▤" },
    { href: "/admin/content?kind=post", name: "Posts", symbol: "✎" },
    { href: "/admin/taxonomy", name: "Categories & tags", symbol: "#" },
    { href: "/admin/media", name: "Media library", symbol: "▧" },
    ...(!actor.roles.includes("author")
      ? [{ href: "/admin/navigation", name: "Navigation", symbol: "☷" }]
      : []),
    { href: "/admin/revisions", name: "Revisions", symbol: "↶" },
    ...(actor.roles.includes("administrator")
      ? [
          { href: "/admin/settings", name: "Site settings", symbol: "⚙" },
          { href: "/admin/users", name: "People & access", symbol: "♧" },
        ]
      : []),
  ];
  return (
    <div className="cms-layout">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <aside className="cms-sidebar">
        <a className="cms-brand" href="/admin">
          <span className="cms-monogram">c.</span>
          <span>
            CMS Starter<small>THE EDITORIAL DESK</small>
          </span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Administration">
          {nav.map((link) => (
            <a key={link.href} href={link.href}>
              <span aria-hidden="true">{link.symbol}</span>
              {link.name}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/" target="_blank" rel="noopener noreferrer">
            View public website ↗
          </a>
          <div className="profile">
            <span className="avatar">{actor.name.slice(0, 1)}</span>
            <span>
              {actor.name}
              <small>{actor.roles[0]}</small>
            </span>
          </div>
          <SignOut />
        </div>
      </aside>
      <div className="cms-workspace">
        <header className="cms-topbar">
          <span className="small muted">Your website. Your words.</span>
          <a href="/admin/new" className="button">
            + Create content
          </a>
        </header>
        <main id="admin-main" className="cms-main">
          {children}
        </main>
      </div>
    </div>
  );
}
