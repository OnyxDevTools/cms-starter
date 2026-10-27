// filename: app/api/admin/[...operation]/route.ts
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth";
import { getCMS } from "@/lib/server";
import { AppError, RevisionInput } from "@/lib/domain";
import { problem, readBody, sameOrigin } from "@/lib/http";
import { uploadMedia } from "@/lib/media";
import { role } from "@/lib/cms/service";
import { firebaseAdmin } from "@/lib/auth/admin";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string[] }> },
) {
  try {
    const actor = await requireEditor();
    sameOrigin(request);
    const operation = (await params).operation.join("/"),
      service = getCMS();
    if (operation === "media") {
      const bytes = await readBody(request, 5 * 1024 * 1024 + 20000),
        form = await new Response(bytes, {
          headers: {
            "Content-Type": request.headers.get("content-type") || "",
          },
        }).formData(),
        file = form.get("file"),
        pageId = z.uuid().parse(form.get("pageId"));
      await service.authorized(actor, pageId);
      if (!(file instanceof File)) throw new AppError(422, "Choose an image.");
      return Response.json(
        await uploadMedia(
          pageId,
          file,
          z.string().parse(form.get("alt")),
          actor.userId,
        ),
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new AppError(415, "Send JSON.");
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(await readBody(request)));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(400, "Malformed JSON.");
    }
    let result: unknown = { saved: true };
    if (operation === "create")
      result = await service.createDraft(actor, RevisionInput.parse(body));
    else if (operation === "settings")
      await service.settingsUpdate(actor, body);
    else if (operation === "navigation")
      await service.navigationUpdate(actor, body);
    else if (operation === "taxonomy")
      result = await service.saveTerm(actor, body);
    else if (operation === "user") {
      role(actor, ["administrator"]);
      const input = z
        .object({
          email: z.email(),
          role: z.enum(["administrator", "editor", "author"]),
          active: z.boolean(),
        })
        .strict()
        .parse(body);
      const user = await firebaseAdmin().getUserByEmail(input.email);
      if (!user.emailVerified || user.disabled)
        throw new AppError(
          422,
          "The Firebase user must have a verified, active account.",
        );
      const old = await service.store.get("CMSUser", user.uid);
      result = await service.userUpdate(actor, {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email,
        role: input.role,
        active: input.active,
        createdAt: old?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const input = z
        .object({
          id: z.uuid(),
          editToken: z.string().optional(),
          publicationToken: z.string().optional(),
          revision: RevisionInput.optional(),
          revisionId: z.string().optional(),
          archived: z.boolean().optional(),
          alt: z.string().optional(),
          caption: z.string().optional(),
        })
        .strict()
        .parse(body);
      if (operation === "duplicate")
        result = await service.duplicate(actor, input.id);
      else if (operation === "media-delete")
        await service.deleteMedia(actor, input.id);
      else if (operation === "media-update")
        await service.editMedia(actor, input.id, {
          alt: input.alt || "",
          caption: input.caption || "",
        });
      else if (operation === "unpublish") {
        if (!input.publicationToken)
          throw new AppError(422, "Publication token required.");
        result = await service.unpublishContent(
          actor,
          input.id,
          input.publicationToken,
        );
      } else if (operation === "archive") {
        if (!input.editToken || input.archived === undefined)
          throw new AppError(422, "Archive state and edit token required.");
        result = await service.archive(
          actor,
          input.id,
          input.editToken,
          input.archived,
        );
      } else if (operation === "restore-revision") {
        if (!input.editToken || !input.revisionId)
          throw new AppError(422, "Revision and edit token required.");
        result = await service.restoreRevision(
          actor,
          input.id,
          input.revisionId,
          input.editToken,
        );
      } else if (["save", "autosave", "publish"].includes(operation)) {
        if (!input.editToken || !input.revision)
          throw new AppError(422, "Draft token and content required.");
        result =
          operation === "autosave"
            ? await service.checkpoint(
                actor,
                input.id,
                input.editToken,
                input.revision,
              )
            : operation === "save"
              ? await service.saveDraft(
                  actor,
                  input.id,
                  input.editToken,
                  input.revision,
                )
              : await service.publishDraft(
                  actor,
                  input.id,
                  input.editToken,
                  input.publicationToken || "",
                  input.revision,
                );
      } else throw new AppError(404, "Unknown CMS operation.");
    }
    if (
      [
        "publish",
        "unpublish",
        "archive",
        "settings",
        "navigation",
        "media-delete",
        "media-update",
      ].includes(operation)
    ) {
      revalidatePath("/", "layout");
      revalidatePath("/sitemap.xml");
      revalidatePath("/feed.xml");
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return problem(error);
  }
}
