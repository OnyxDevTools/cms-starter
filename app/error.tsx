"use client";
// filename: app/error.tsx

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container page-header">
      <h1>Temporarily unavailable.</h1>
      <p>The site could not read its published content. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
