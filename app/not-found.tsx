// filename: app/not-found.tsx
export default function NotFound() {
  return (
    <main id="main" className="container page-header">
      <p className="eyebrow">404</p>
      <h1>Page not found.</h1>
      <p>This address is unavailable or is no longer published.</p>
      <a href="/">Return home</a>
    </main>
  );
}
