// filename: app/media/[id]/route.ts
import sharp from "sharp";
import { z } from "zod";
import { requireEditor } from "@/lib/auth";
import { getService, getCMS } from "@/lib/server";
import { publicMedia, widths } from "@/lib/media";
import { AppError } from "@/lib/domain";
import { problem } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id),
      url = new URL(request.url);
    let media;
    if (url.searchParams.get("preview") === "1") {
      const actor = await requireEditor();
      media = await getCMS().mediaAccess(actor, id);
      if (!media) throw new AppError(404, "Image not found.");
    } else media = await publicMedia(id);
    const width = Number(url.searchParams.get("w") || 960);
    if (!widths.includes(width) && width !== media.width)
      throw new AppError(422, "Unsupported image width.");
    const original = await getService().store.document(media.documentId);
    const bytes = await sharp(original, { limitInputPixels: 4096 * 4096 })
      .rotate()
      .resize({ width: Math.min(width, media.width), withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return problem(error);
  }
}
