// filename: app/api/ready/route.ts
import { getService } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getService().settings();
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
