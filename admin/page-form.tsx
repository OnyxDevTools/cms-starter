"use client";
// filename: admin/page-form.tsx
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  RevisionInput,
  type Document,
  type Page,
  type Revision,
  type Media,
  type Rows,
} from "@/lib/domain";
const Editor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => <p>Loading editor…</p>,
});
function localDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const empty: Document = {
  version: 1,
  root: {
    type: "root",
    version: 1,
    children: [{ type: "paragraph", version: 1, children: [] }],
  },
};
const titles = z.object({
  title: z.string().trim().min(1).max(120),
  path: z.string().min(1).max(180),
  summary: z.string().trim().min(1).max(320),
});
export function PageForm({
  initial,
  snapshot,
  media,
  terms,
  revisions,
  canPublish,
  kind = "page",
}: {
  initial: Page | null;
  snapshot: { revision: Revision; document: Document } | null;
  media: Media[];
  terms: Rows["Taxonomy"][];
  revisions: Revision[];
  canPublish: boolean;
  kind?: "page" | "post";
}) {
  const router = useRouter(),
    [page, setPage] = useState(initial),
    [images, setImages] = useState(media),
    [value, setValue] = useState(() =>
      RevisionInput.parse(
        snapshot
          ? { ...snapshot.revision, document: snapshot.document }
          : {
              path: kind === "post" ? "/posts/new-post" : "/new-page",
              title: "Untitled draft",
              summary: "Add a useful excerpt before publication.",
              layout: kind === "post" ? "detail" : "content",
              contentType: kind,
              seoTitle: "",
              seoDescription: "",
              indexable: true,
              heroMediaId: "",
              toc: false,
              document: empty,
            },
      ),
    ),
    [status, setStatus] = useState("Saved"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [selectedRevision, setSelectedRevision] = useState("");
  const lock = useRef(false),
    paused = useRef(false),
    saved = useRef(JSON.stringify(value)),
    latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const form = useForm<z.infer<typeof titles>>({
    resolver: zodResolver(titles),
    values: { title: value.title, path: value.path, summary: value.summary },
  });
  function field<K extends keyof typeof value>(
    key: K,
    next: (typeof value)[K],
  ) {
    setValue((v) => ({ ...v, [key]: next }));
    setStatus("Unsaved changes");
  }
  const act = useCallback(
    async (operation: string, extra: object = {}) => {
      if (lock.current) return;
      const payload = latest.current;
      if (
        operation === "autosave" &&
        (paused.current ||
          JSON.stringify(payload) === saved.current ||
          !RevisionInput.safeParse(payload).success)
      )
        return;
      if (
        operation === "archive" &&
        !window.confirm(
          page?.archived
            ? "Restore this archived item as an unpublished draft?"
            : "Archive this item and remove its publication?",
        )
      )
        return;
      if (
        operation === "unpublish" &&
        !window.confirm("Remove this item from the public website?")
      )
        return;
      lock.current = true;
      setBusy(operation);
      setError("");
      setStatus(operation === "autosave" ? "Saving…" : "Working…");
      const serialized = JSON.stringify(payload);
      try {
        const response = await fetch(`/api/admin/${operation}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            operation === "create"
              ? payload
              : {
                  id: page?.id,
                  editToken: page?.editToken,
                  publicationToken: page?.publicationToken,
                  revision:
                    operation === "save" ||
                    operation === "autosave" ||
                    operation === "publish"
                      ? payload
                      : undefined,
                  ...extra,
                },
          ),
        });
        const body = await response.json();
        if (!response.ok) {
          if (response.status === 409) {
            paused.current = true;
            setStatus("Conflict");
          } else setStatus("Save failed");
          throw new Error(body.detail || "Could not save.");
        }
        setPage(body as Page);
        saved.current = serialized;
        setStatus(
          serialized === JSON.stringify(latest.current)
            ? operation === "publish"
              ? "Published"
              : operation === "autosave"
                ? "Draft autosaved"
                : "Saved revision"
            : "Unsaved changes",
        );
        if (operation === "create" || operation === "duplicate")
          router.push(`/admin/${body.id}`);
        else if (operation === "restore-revision" || operation === "archive") {
          router.refresh();
        } else if (operation === "publish" || operation === "unpublish")
          router.refresh();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Save failed. Your changes are preserved.",
        );
        if (!paused.current) setStatus("Save failed");
      } finally {
        lock.current = false;
        setBusy("");
      }
    },
    [page, router],
  );
  useEffect(() => {
    if (!page || page.archived || paused.current) return;
    const timer = setTimeout(() => void act("autosave"), 1800);
    return () => clearTimeout(timer);
  }, [value, page, act]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (saved.current !== JSON.stringify(latest.current)) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  const formField = (
    key: "title" | "path" | "summary",
    label: string,
    area = false,
  ) => (
    <label className="field" htmlFor={`content-${key}`}>
      {label}
      {area ? (
        <textarea
          {...form.register(key)}
          id={`content-${key}`}
          aria-label={label}
          aria-invalid={!!form.formState.errors[key]}
          value={value[key]}
          onChange={(e) => field(key, e.target.value)}
          maxLength={key === "summary" ? 320 : 180}
        />
      ) : (
        <input
          {...form.register(key)}
          id={`content-${key}`}
          aria-label={label}
          aria-invalid={!!form.formState.errors[key]}
          value={value[key]}
          onChange={(e) => field(key, e.target.value)}
          maxLength={key === "title" ? 120 : 180}
        />
      )}
      {form.formState.errors[key] && (
        <span className="error">{form.formState.errors[key]?.message}</span>
      )}
    </label>
  );
  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(() => act(page ? "save" : "create"))(event);
      }}
      className="editor-layout"
    >
      <div className="editor-main">
        <div className="editor-topline">
          <span className="eyebrow">
            {value.contentType} /{" "}
            {page?.archived
              ? "Archived"
              : page?.publishedRevisionId
                ? "Published + working draft"
                : "Draft"}
          </span>
          <span
            role="status"
            className={`save-status ${status === "Conflict" || status === "Save failed" ? "error" : ""}`}
          >
            {status}
          </span>
        </div>
        {error && (
          <p role="alert" className="error">
            {error} Your unsaved changes remain in this editor.
          </p>
        )}
        <fieldset
          disabled={(!!busy && busy !== "autosave") || page?.archived}
          className="editor-fields"
        >
          {formField("title", "Title")}
          {formField("path", "Slug / full path")}
          {formField("summary", "Excerpt", true)}
          <Editor
            value={value.document}
            onChange={(doc) => field("document", doc)}
            pageId={page?.id}
            media={images}
            readOnly={!!page?.archived}
            onMediaAdded={(image) =>
              setImages((rows) =>
                rows.some((row) => row.id === image.id)
                  ? rows
                  : [...rows, image],
              )
            }
          />
          <details className="panel">
            <summary>Search & sharing</summary>
            <div className="form-grid">
              <label className="field">
                SEO title
                <input
                  value={value.seoTitle}
                  maxLength={70}
                  onChange={(e) => field("seoTitle", e.target.value)}
                />
              </label>
              <label className="field">
                SEO description
                <textarea
                  value={value.seoDescription}
                  maxLength={180}
                  onChange={(e) => field("seoDescription", e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Canonical path (optional, on this site)
              <input
                value={value.canonicalPath}
                onChange={(e) => field("canonicalPath", e.target.value)}
              />
            </label>
            <label className="field">
              Social image
              <select
                value={value.socialMediaId}
                onChange={(e) => field("socialMediaId", e.target.value)}
              >
                <option value="">Site default</option>
                {images.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={value.indexable}
                onChange={(e) => field("indexable", e.target.checked)}
              />{" "}
              Allow search indexing when published
            </label>
          </details>
        </fieldset>
      </div>
      <aside className="editor-sidebar">
        <section className="panel">
          <h2>Publishing</h2>
          <p className="muted small">
            Drafts stay private. Only Publish changes the live website.
          </p>
          <div className="stack">
            <Button type="submit" disabled={!!busy || page?.archived}>
              {page ? "Save revision" : "Create draft"}
            </Button>
            {page && (
              <>
                <a
                  className="button secondary"
                  href={`/preview/${page.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preview draft ↗
                </a>
                {canPublish && (
                  <>
                    <Button
                      type="button"
                      disabled={!!busy || page.archived}
                      onClick={() => void act("publish")}
                    >
                      Publish
                    </Button>
                    {page.publishedRevisionId && (
                      <Button
                        variant="outline"
                        type="button"
                        disabled={!!busy}
                        onClick={() => void act("unpublish")}
                      >
                        Unpublish
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="outline"
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act("duplicate")}
                >
                  Duplicate
                </Button>
                {canPublish && (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={!!busy}
                    onClick={() =>
                      void act("archive", { archived: !page.archived })
                    }
                  >
                    {page.archived ? "Restore archived item" : "Archive"}
                  </Button>
                )}
              </>
            )}
          </div>
        </section>
        <section className="panel">
          <h2>Details</h2>
          <fieldset
            className="editor-fields"
            aria-label="Content details"
            disabled={!!page?.archived || (!!busy && busy !== "autosave")}
          >
            <label className="field">
              Layout
              <select
                value={value.layout}
                onChange={(e) =>
                  field("layout", e.target.value as typeof value.layout)
                }
              >
                {["home", "content", "collection", "detail"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Author attribution
              <input
                value={value.authorName}
                maxLength={100}
                onChange={(e) => field("authorName", e.target.value)}
              />
            </label>
            <label className="field">
              Publication date (metadata, not scheduling)
              <input
                type="datetime-local"
                value={localDateInput(value.publishedAt)}
                onChange={(e) =>
                  field(
                    "publishedAt",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  )
                }
              />
            </label>
            <label className="field">
              Featured image
              <select
                aria-label="Featured image"
                value={value.heroMediaId}
                onChange={(e) => field("heroMediaId", e.target.value)}
              >
                <option value="">No image</option>
                {images.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alt}
                  </option>
                ))}
              </select>
            </label>
            <p className="small muted">
              Use Image alt text and Upload image in the body toolbar. Images
              belong to this content item.
            </p>
            <label>
              <input
                type="checkbox"
                checked={value.toc}
                onChange={(e) => field("toc", e.target.checked)}
              />{" "}
              Table of contents
            </label>
          </fieldset>
        </section>
        {value.contentType === "post" && (
          <section className="panel">
            <h2>Categories & tags</h2>
            {terms
              .filter((t) => !t.archived)
              .map((t) => (
                <label key={t.id} className="check-row">
                  <input
                    type="checkbox"
                    disabled={
                      !!page?.archived || (!!busy && busy !== "autosave")
                    }
                    checked={value.terms.split(",").includes(t.id)}
                    onChange={(e) => {
                      const ids = value.terms.split(",").filter(Boolean);
                      field(
                        "terms",
                        e.target.checked
                          ? [...ids, t.id].join(",")
                          : ids.filter((id) => id !== t.id).join(","),
                      );
                    }}
                  />
                  {t.name}
                  <span className="muted">{t.kind}</span>
                </label>
              ))}
            {!terms.length && (
              <p className="small muted">
                An editor can add categories and tags from Taxonomy.
              </p>
            )}
          </section>
        )}
        {page && (
          <section className="panel">
            <h2>Revision history</h2>
            <p className="small muted">
              Autosaves are temporary working drafts. Save revision and Publish
              create history.
            </p>
            <label className="field">
              Saved revision
              <select
                aria-label="Saved revision"
                value={selectedRevision}
                onChange={(e) => setSelectedRevision(e.target.value)}
              >
                <option value="">Choose a revision</option>
                {revisions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.createdAt).toLocaleString()} · {r.action} ·{" "}
                    {r.authorName}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              type="button"
              disabled={!selectedRevision || !!busy || page.archived}
              onClick={() => {
                if (
                  window.confirm(
                    "Restore this revision into a new draft? The current public version will remain live.",
                  )
                )
                  void act("restore-revision", {
                    revisionId: selectedRevision,
                  });
              }}
            >
              Restore as draft
            </Button>
          </section>
        )}
      </aside>
    </form>
  );
}
