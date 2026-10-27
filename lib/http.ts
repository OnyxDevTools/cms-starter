// filename: lib/http.ts
import "server-only";
import { ZodError } from "zod";
import { AppError } from "./domain";
export function problem(error: unknown) {
  const status =
    error instanceof AppError
      ? error.status
      : error instanceof ZodError
        ? 422
        : 500;
  const detail =
    error instanceof AppError
      ? error.message
      : error instanceof ZodError
        ? error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")
        : "The operation could not be completed.";
  return Response.json(
    {
      title: status === 500 ? "Server error" : "Request failed",
      status,
      detail,
    },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
export async function readBody(request: Request, max = 150000) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new AppError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function limitedText(request: Request, maximum = 65536) {
  return new TextDecoder().decode(await readBody(request, maximum));
}
export function sameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN;
  if (!expected || new URL(expected).origin !== expected)
    throw new AppError(
      503,
      "Configure APP_ORIGIN as the exact trusted application origin.",
    );
  if (
    request.headers.get("origin") !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError(403, "Same-origin requests are required.");
}
