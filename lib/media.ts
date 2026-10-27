// filename: lib/media.ts
import "server-only";
import sharp, { type Metadata } from "sharp";
import { randomUUID } from "node:crypto";
import { AppError } from "./domain";
import { getService } from "./server";
export const widths = [320, 640, 960, 1280, 1600];
export async function uploadMedia(
  ownerPageId: string,
  file: File,
  alt: string,
  ownerUid = "seed",
) {
  const service = getService();
  await service.page(ownerPageId);
  if (
    file.size > 5 * 1024 * 1024 ||
    !file.size ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new AppError(422, "Use a PNG, JPEG, or WebP image up to 5 MB.");
  if (!alt.trim() || alt.length > 240)
    throw new AppError(422, "Add descriptive alt text (up to 240 characters).");
  const bytes = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(bytes, {
      limitInputPixels: 4096 * 4096,
      animated: false,
    }).metadata();
  } catch {
    throw new AppError(422, "Invalid image.");
  }
  const mime: "image/png" | "image/jpeg" | "image/webp" | null =
    meta.format === "png"
      ? "image/png"
      : meta.format === "jpeg"
        ? "image/jpeg"
        : meta.format === "webp"
          ? "image/webp"
          : null;
  if (
    !mime ||
    mime !== file.type ||
    !meta.width ||
    !meta.height ||
    meta.width > 4096 ||
    meta.height > 4096 ||
    (meta.pages || 1) > 1
  )
    throw new AppError(
      422,
      "Unsupported image dimensions, animation, or content type.",
    );
  const normalized = await sharp(bytes, { limitInputPixels: 4096 * 4096 })
    .rotate()
    .toBuffer();
  const dimensions = await sharp(normalized).metadata();
  const id = randomUUID();
  await service.store.saveDocument(id, mime, normalized);
  const media = {
    id,
    documentId: id,
    ownerPageId,
    ownerUid,
    name: file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 120),
    caption: "",
    deleted: false,
    width: dimensions.width!,
    height: dimensions.height!,
    mime,
    alt: alt.trim(),
    createdAt: new Date().toISOString(),
  };
  await service.store.insert("Media", media);
  return media;
}
export async function publicMedia(id: string) {
  return getService().publishedMedia(id);
}
