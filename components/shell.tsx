// filename: components/shell.tsx
import type { ReactNode } from "react";
import { getNavigation, getSite } from "@/lib/server";
export async function PublicShell({ children }: { children: ReactNode }) {
  const [site, links] = await Promise.all([getSite(), getNavigation()]);
  const header = links.filter((link) => link.location === "header"),
    footer = links.filter((link) => link.location === "footer");
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <a href="/" className="wordmark">
            <span className="brand-mark" aria-hidden="true">
              c
            </span>
            {site.logoMediaId && (
              <img
                src={`/media/${site.logoMediaId}?w=320`}
                alt=""
                width="32"
                height="32"
              />
            )}
            {site.name}
          </a>
          <nav aria-label="Main navigation" className="desktop-nav">
            {header.map((link) => (
              <a key={link.id} href={link.path}>
                {link.label}
              </a>
            ))}
          </nav>
          <details className="mobile-nav">
            <summary>Menu</summary>
            <nav aria-label="Mobile navigation">
              {header.map((link) => (
                <a key={link.id} href={link.path}>
                  {link.label}
                </a>
              ))}
            </nav>
          </details>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <a className="wordmark" href="/">
              {site.name}
            </a>
            <p>{site.description}</p>
          </div>
          <nav aria-label="Footer navigation">
            {footer.map((link) => (
              <a key={link.id} href={link.path}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="container footer-note">{site.footerText}</div>
      </footer>
    </>
  );
}
