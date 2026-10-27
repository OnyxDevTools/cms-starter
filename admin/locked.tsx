// filename: admin/locked.tsx
import { AppError } from "@/lib/domain";
export function Locked({ error }: { error: unknown }) {
  const message =
    error instanceof AppError
      ? error.message
      : "Administration is unavailable.";
  return (
    <main className="admin-shell">
      <p className="eyebrow">Protected administration</p>
      <h1>Administration is locked.</h1>
      <p role="alert">{message}</p>
      <p>
        No private content was loaded. Configure application Firebase, publish
        the CMS schema, and bootstrap a verified administrator as described in
        README.md.
      </p>
      <a href="/sign-in">Sign in</a>
      <br />
      <a href="/">Return to the public site</a>
    </main>
  );
}
