"use client";
// filename: app/global-error.tsx

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Temporarily unavailable.</h1>
          <p>Published content could not be loaded.</p>
          <a href="/">Try again</a>
        </main>
      </body>
    </html>
  );
}
