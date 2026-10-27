"use client";
// filename: admin/management.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Rows, Site, Media } from "@/lib/domain";
async function post(operation: string, value: unknown) {
  const response = await fetch(`/api/admin/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || "Could not save.");
  return body;
}
function useSave() {
  const router = useRouter(),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(operation: string, value: unknown) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await post(operation, value);
      setNotice("Saved successfully.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  return {
    save,
    busy,
    feedback: (
      <>
        <p role="status" className="success">
          {notice}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </>
    ),
  };
}
export function TaxonomyForm({
  initial,
  canEdit,
}: {
  initial: Rows["Taxonomy"] | null;
  canEdit: boolean;
}) {
  const [state, setState] = useState(
      initial || {
        id: crypto.randomUUID(),
        kind: "category" as const,
        name: "",
        slug: "",
        description: "",
        archived: false,
        updatedAt: new Date().toISOString(),
      },
    ),
    actions = useSave();
  if (!canEdit)
    return (
      <p className="panel muted">
        Editors and administrators manage categories and tags.
      </p>
    );
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        void actions.save("taxonomy", {
          ...state,
          updatedAt: new Date().toISOString(),
        });
      }}
    >
      <h2>{initial ? "Edit taxonomy" : "New category or tag"}</h2>
      <div className="form-grid">
        <label className="field">
          Name
          <input
            required
            value={state.name}
            maxLength={80}
            onChange={(e) => setState({ ...state, name: e.target.value })}
          />
        </label>
        <label className="field">
          Slug
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={state.slug}
            maxLength={100}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        Type
        <select
          value={state.kind}
          onChange={(e) =>
            setState({ ...state, kind: e.target.value as typeof state.kind })
          }
        >
          <option value="category">Category</option>
          <option value="tag">Tag</option>
        </select>
      </label>
      <label className="field">
        Description
        <textarea
          value={state.description}
          maxLength={500}
          onChange={(e) => setState({ ...state, description: e.target.value })}
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={state.archived}
          onChange={(e) => setState({ ...state, archived: e.target.checked })}
        />
        Archived (preserves existing publication history)
      </label>
      <Button disabled={actions.busy}>Save taxonomy</Button>
      {actions.feedback}
    </form>
  );
}
export function UserForm() {
  const [email, setEmail] = useState(""),
    [role, setRole] = useState("author"),
    [active, setActive] = useState(true),
    actions = useSave();
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        void actions.save("user", { email, role, active });
      }}
    >
      <h2>Manage access</h2>
      <p className="muted small">
        Use an existing verified Firebase user’s email. This grants or updates
        CMS access; it does not create passwords or accounts.
      </p>
      <label className="field">
        User email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="field">
        CMS role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="administrator">Administrator</option>
          <option value="editor">Editor</option>
          <option value="author">Author</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active access
      </label>
      <Button disabled={actions.busy}>Save access</Button>
      {actions.feedback}
    </form>
  );
}
export function SiteForm({ site, media }: { site: Site; media: Media[] }) {
  const [state, setState] = useState(site),
    actions = useSave();
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (window.confirm("Apply these public website settings?"))
          void actions.save("settings", state);
      }}
    >
      <h2>Website identity</h2>
      <p className="muted">
        These changes apply to the public website when saved.
      </p>
      {(
        [
          { key: "name", label: "Site name" },
          { key: "description", label: "Site description" },
          { key: "origin", label: "Canonical site origin" },
          { key: "organizationName", label: "Organization name (optional)" },
          { key: "organizationURL", label: "Organization website (optional)" },
          { key: "footerText", label: "Footer text" },
        ] as const
      ).map((item) => (
        <label className="field" key={item.key}>
          {item.label}
          <input
            value={state[item.key]}
            onChange={(e) => setState({ ...state, [item.key]: e.target.value })}
          />
        </label>
      ))}
      {(
        [
          { key: "logoMediaId", label: "Site logo" },
          { key: "socialMediaId", label: "Default social image" },
        ] as const
      ).map((item) => (
        <label key={item.key} className="field">
          {item.label}
          <select
            value={state[item.key]}
            onChange={(e) => setState({ ...state, [item.key]: e.target.value })}
          >
            <option value="">Bundled default</option>
            {media.map((image) => (
              <option key={image.id} value={image.id}>
                {image.name} · {image.alt}
              </option>
            ))}
          </select>
        </label>
      ))}
      <Button disabled={actions.busy}>Apply public settings</Button>
      {actions.feedback}
    </form>
  );
}
export function NavigationForm({
  initial,
  pages,
}: {
  initial: Rows["NavigationLink"][];
  pages: { id: string; title: string; path: string }[];
}) {
  const [links, setLinks] = useState(initial.filter((l) => l.enabled)),
    actions = useSave();
  function change(index: number, value: Partial<Rows["NavigationLink"]>) {
    setLinks((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...value } : row)),
    );
  }
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        void actions.save(
          "navigation",
          links.map((row, position) => ({ ...row, position })),
        );
      }}
    >
      <h2>Header & footer links</h2>
      <p className="muted small">
        Links resolve the selected content’s published URL. Draft-only content
        stays hidden.
      </p>
      {links.map((link, index) => (
        <fieldset key={link.id} className="nav-edit-row">
          <legend>Link {index + 1}</legend>
          <label className="field">
            Label
            <input
              required
              maxLength={50}
              value={link.label}
              onChange={(e) => change(index, { label: e.target.value })}
            />
          </label>
          <label className="field">
            Content
            <select
              required
              value={link.pageId}
              onChange={(e) => {
                const page = pages.find((p) => p.id === e.target.value);
                if (page) change(index, { pageId: page.id, path: page.path });
              }}
            >
              <option value="">Choose content</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Location
            <select
              value={link.location}
              onChange={(e) =>
                change(index, {
                  location: e.target.value as "header" | "footer",
                })
              }
            >
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!index}
            onClick={() =>
              setLinks((rows) => {
                const next = [...rows];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                return next;
              })
            }
          >
            Move up
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setLinks((rows) => rows.filter((_, i) => i !== index))
            }
          >
            Remove
          </Button>
        </fieldset>
      ))}
      <div className="button-row">
        <Button
          variant="outline"
          type="button"
          disabled={links.length >= 32}
          onClick={() =>
            setLinks((rows) => [
              ...rows,
              {
                id: crypto.randomUUID(),
                pageId: "",
                path: "/",
                label: "",
                location: "header",
                position: rows.length,
                enabled: true,
              },
            ])
          }
        >
          Add link
        </Button>
        <Button disabled={actions.busy}>Apply public navigation</Button>
      </div>
      {actions.feedback}
    </form>
  );
}
export function MediaForm({
  selected,
  pages,
  canDelete,
  canEdit,
}: {
  selected: Media | null;
  canDelete: boolean;
  canEdit: boolean;
  pages: { id: string; title: string }[];
}) {
  const [alt, setAlt] = useState(selected?.alt || ""),
    [caption, setCaption] = useState(selected?.caption || ""),
    [pageId, setPageId] = useState(pages[0]?.id || ""),
    [file, setFile] = useState<File | null>(null),
    [uploadBusy, setUploadBusy] = useState(false),
    [uploadError, setUploadError] = useState(""),
    [notice, setNotice] = useState(""),
    actions = useSave(),
    router = useRouter();
  return (
    <section className="panel">
      <h2>{selected ? "Media details" : "Upload an image"}</h2>
      {!canEdit && (
        <p className="muted">
          This image is public. An editor must update its metadata.
        </p>
      )}
      {selected && (
        <img
          className="media-thumbnail"
          src={`/media/${selected.id}?preview=1&w=320`}
          alt={selected.alt}
          width={Math.min(selected.width, 320)}
          height={Math.round(
            (selected.height * Math.min(selected.width, 320)) / selected.width,
          )}
        />
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (selected) {
            await actions.save("media-update", {
              id: selected.id,
              alt,
              caption,
            });
            return;
          }
          if (!file) return;
          setUploadBusy(true);
          setUploadError("");
          try {
            const data = new FormData();
            data.set("file", file);
            data.set("pageId", pageId);
            data.set("alt", alt);
            const response = await fetch("/api/admin/media", {
                method: "POST",
                body: data,
              }),
              body = await response.json();
            if (!response.ok) throw new Error(body.detail || "Upload failed.");
            setNotice("Image uploaded as private draft media.");
            router.refresh();
          } catch (error) {
            setUploadError(
              error instanceof Error ? error.message : "Upload failed.",
            );
          } finally {
            setUploadBusy(false);
          }
        }}
      >
        {!selected && (
          <>
            <label className="field">
              Associated content
              <select
                required
                aria-label="Associated content"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              >
                <option value="">Choose content</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Image file
              <input
                required
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </>
        )}
        <label className="field">
          Alt text
          <input
            required
            disabled={!canEdit}
            value={alt}
            maxLength={240}
            onChange={(e) => setAlt(e.target.value)}
          />
        </label>
        {selected && (
          <label className="field">
            Caption
            <textarea
              disabled={!canEdit}
              value={caption}
              maxLength={500}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
        )}
        <div className="button-row">
          <Button
            disabled={
              !canEdit ||
              actions.busy ||
              uploadBusy ||
              (!selected && !pages.length)
            }
          >
            {selected ? "Save media details" : "Upload private image"}
          </Button>
          {selected && canDelete && (
            <Button
              type="button"
              variant="outline"
              disabled={actions.busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Remove this image from the media library? Published references block removal.",
                  )
                )
                  void actions.save("media-delete", { id: selected.id });
              }}
            >
              Remove image
            </Button>
          )}
        </div>
        {actions.feedback}
        {notice && <p role="status">{notice}</p>}
        {uploadError && (
          <p role="alert" className="error">
            {uploadError}
          </p>
        )}
      </form>
    </section>
  );
}
