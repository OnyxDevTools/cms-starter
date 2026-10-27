// filename: tests/e2e/editorial.spec.ts
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function login(page: Page, email = "admin@example.test") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("development-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A good day to publish." }),
  ).toBeVisible();
}
async function json(page: Page, path: string, body: object) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    },
    { path, body },
  );
}
test("editorial draft, autosave, preview, publication, revision and redirects", async ({
  page,
  browser,
}, info) => {
  await login(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "desktop")
    await page.screenshot({
      path: "public/template-preview.png",
      fullPage: true,
    });
  await page.getByRole("link", { name: "+ New page", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make something worth reading." }),
  ).toBeVisible();
  const route = `/editorial-${info.project.name}`;
  await page.getByLabel("Title", { exact: true }).fill("A new editorial story");
  await page.getByLabel("Slug / full path", { exact: true }).fill(route);
  await page
    .getByLabel("Excerpt", { exact: true })
    .fill("A thoughtful story from the editorial team.");
  await page
    .getByRole("textbox", { name: "Page body", exact: true })
    .fill("A useful first paragraph.");
  await page.getByRole("button", { name: "Insert table", exact: true }).click();
  await expect(
    page
      .getByRole("textbox", { name: "Page body", exact: true })
      .locator("table"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/[a-f0-9-]+$/);
  await expect(
    page.getByRole("button", { name: "Save revision" }),
  ).toBeVisible();
  const id = page.url().split("/").at(-1)!;
  const date = page.getByLabel("Publication date (metadata, not scheduling)", {
    exact: true,
  });
  await date.fill("2026-10-27T09:30");
  await expect(date).toHaveValue("2026-10-27T09:30");
  expect((await page.request.get(route)).status()).toBe(404);
  await page
    .getByLabel("Title", { exact: true })
    .fill("An autosaved editorial story");
  await expect(page.getByRole("status")).toContainText("Draft autosaved");
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "An autosaved editorial story",
  );
  const preview = await page.context().newPage();
  await preview.goto(`/preview/${id}`);
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "An autosaved editorial story",
  );
  await expect(preview.getByRole("status")).toContainText(
    "Private draft preview",
  );
  await preview.close();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/Saved|Published/);
  await expect
    .poll(async () => (await page.request.get(route)).text())
    .toContain("An autosaved editorial story");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Private second version");
  await expect(page.getByRole("status")).toContainText("Draft autosaved");
  const html = await (await page.request.get(route)).text();
  expect(html).toContain("An autosaved editorial story");
  expect(html).not.toContain("Private second version");
  await page
    .getByLabel("Slug / full path", { exact: true })
    .fill(`${route}-renamed`);
  await expect(page.getByRole("status")).toContainText("Draft autosaved");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect
    .poll(async () =>
      (await page.request.get(route, { maxRedirects: 0 })).status(),
    )
    .toBe(308);
  await expect
    .poll(async () => (await page.request.get(`${route}-renamed`)).text())
    .toContain("Private second version");
  const select = page.getByLabel("Saved revision", { exact: true });
  await select.selectOption({ index: 1 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore as draft" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(await (await page.request.get(`${route}-renamed`)).text()).toContain(
    "Private second version",
  );
  const stranger = await browser.newContext();
  const anonymous = await stranger.request.get(`/preview/${id}`);
  expect(await anonymous.text()).not.toContain("A useful first paragraph.");
  await stranger.close();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect
    .poll(async () => (await page.request.get(`${route}-renamed`)).status())
    .toBe(404);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".editor-content")).toHaveAttribute(
    "contenteditable",
    "false",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Restore archived item", exact: true })
    .click();
  await expect(page.locator(".editor-content")).toHaveAttribute(
    "contenteditable",
    "true",
  );
});
test("authors cannot publish, alter settings, or access another author's drafts", async ({
  page,
  browser,
}) => {
  await login(page, "author@example.test");
  await page.goto("/admin/new");
  await page
    .getByLabel("Slug / full path", { exact: true })
    .fill(`/author-${crypto.randomUUID().slice(0, 8)}`);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/[a-f0-9-]+$/);
  expect(
    await page.getByRole("button", { name: "Publish", exact: true }).count(),
  ).toBe(0);
  const id = page.url().split("/").at(-1)!;
  expect(
    (
      await json(page, "/api/admin/publish", {
        id,
        editToken: "x",
        publicationToken: "x",
        revision: {
          path: "/blocked-author-publish",
          title: "Blocked publication",
          summary: "A valid request rejected by role.",
          layout: "content",
          seoTitle: "",
          seoDescription: "",
          indexable: true,
          heroMediaId: "",
          toc: false,
          document: {
            version: 1,
            root: { type: "root", version: 1, children: [] },
          },
        },
      })
    ).status,
  ).toBe(403);
  expect((await json(page, "/api/admin/settings", {})).status).toBe(403);
  const context = await browser.newContext(),
    other = await context.newPage();
  await login(other, "other@example.test");
  expect((await json(other, "/api/admin/duplicate", { id })).status).toBe(403);
  await context.close();
});
test("media upload, private delivery and published-usage deletion checks", async ({
  page,
  browser,
}, info) => {
  const { default: sharp } = await import("sharp");
  await login(page);
  await page.goto("/admin/media");
  await page
    .getByLabel("Associated content", { exact: true })
    .selectOption({ label: "Simple. Useful. Considered." });
  await page
    .getByLabel("Alt text", { exact: true })
    .fill("A cobalt test image");
  const bytes = await sharp({
    create: { width: 320, height: 200, channels: 3, background: "#264cce" },
  })
    .png()
    .toBuffer();
  const name = `test-${info.project.name}.png`;
  await page
    .getByLabel("Image file", { exact: true })
    .setInputFiles({ name, mimeType: "image/png", buffer: bytes });
  await page.getByRole("button", { name: "Upload private image" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image uploaded" }),
  ).toBeVisible();
  const link = page.getByRole("link", { name, exact: true });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!,
    id = new URL(href, "http://127.0.0.1:3040").searchParams.get("id")!;
  expect((await page.request.get(`/media/${id}?w=320`)).status()).toBe(404);
  expect(
    (await page.request.get(`/media/${id}?preview=1&w=320`)).status(),
  ).toBe(200);
  const outsider = await browser.newContext();
  expect(
    (
      await outsider.request.get(
        `http://127.0.0.1:3040/media/${id}?preview=1&w=320`,
      )
    ).status(),
  ).toBe(401);
  await outsider.close();
  await link.click();
  await page.getByLabel("Caption", { exact: true }).fill("A useful caption.");
  await page.getByRole("button", { name: "Save media details" }).click();
  await expect(page.getByRole("status")).toContainText("Saved successfully");
  await page.goto("/admin/content?kind=page");
  await page
    .getByRole("link", { name: "Simple. Useful. Considered.", exact: true })
    .click();
  await page.getByLabel("Featured image", { exact: true }).selectOption(id);
  await expect(page.getByRole("status")).toContainText("Draft autosaved");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect
    .poll(async () => (await page.request.get(`/media/${id}?w=320`)).status())
    .toBe(200);
  expect((await json(page, "/api/admin/media-delete", { id })).status).toBe(
    409,
  );
  const active = await page.evaluate(
    async ({ id }) => {
      const data = new FormData();
      data.set("pageId", id);
      data.set("alt", "Unsafe SVG");
      data.set(
        "file",
        new File(
          [
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          ],
          "unsafe.svg",
          { type: "image/svg+xml" },
        ),
      );
      return (await fetch("/api/admin/media", { method: "POST", body: data }))
        .status;
    },
    { id: page.url().split("/").at(-1)! },
  );
  expect(active).toBe(422);
});
