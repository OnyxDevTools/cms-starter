// filename: tests/e2e/site.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
async function control(
  request: import("@playwright/test").APIRequestContext,
  body: unknown,
) {
  const { transport } = JSON.parse(
    await readFile(".test-runtime/ports.json", "utf8"),
  );
  const result = await request.post(`${transport}/__test`, {
    headers: { "x-test-control": "seo-fixture-only" },
    data: body,
  });
  expect(result.ok()).toBeTruthy();
}
test.beforeEach(async ({ request }) => control(request, { action: "reset" }));
test("SSR metadata, schema, mobile navigation, and accessibility", async ({
  page,
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain("A clear place to start.");
  expect(new URL(html.match(/rel="canonical" href="([^"]+)"/)![1]).href).toBe(
    "https://example.test/",
  );
  expect(html).toContain("application/ld+json");
  expect(html).not.toContain("ONYX_DATABASE_API_SECRET");
  const scripts: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes(".js")) {
      scripts.push(await response.text());
    }
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A clear place to start.",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  expect(scripts.join(" ")).not.toContain("cms-editor");
  expect(scripts.join(" ")).not.toContain("ONYX_DATABASE_API_SECRET");
  await page.goto("/resources/example");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(
    page.getByRole("navigation", { name: "On this page" }),
  ).toBeVisible();
});
test("public content works without JavaScript and pagination is crawlable", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3040/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("http://127.0.0.1:3040/resources");
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://example.test/resources?page=2",
  );
  await context.close();
  expect((await request.get("/missing")).status()).toBe(404);
});
test("drafts, publish, noindex, redirects and unpublish stay consistent across requests", async ({
  request,
}) => {
  const old = await (await request.get("/about")).text();
  await control(request, {
    action: "draft",
    path: "/about",
    changes: {
      title: "A new published title",
      path: "/new-about",
      indexable: false,
    },
  });
  expect(await (await request.get("/about")).text()).toBe(old);
  expect((await request.get("/new-about")).status()).toBe(404);
  await control(request, { action: "publish", path: "/about" });
  const redirect = await request.get("/about", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe("/new-about");
  const html = await (await request.get("/new-about")).text();
  expect(html).toContain("A new published title");
  expect(html).toContain('content="noindex, follow"');
  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).not.toContain("/admin");
  const urls = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname,
  );
  let shards = "";
  for (const path of urls) shards += await (await request.get(path)).text();
  expect(shards).not.toContain("/new-about");
  expect(shards).not.toContain("/about</loc>");
  await control(request, { action: "unpublish", path: "/new-about" });
  expect((await request.get("/new-about")).status()).toBe(404);
  expect((await request.get("/about")).status()).toBe(404);
});
test("administration and private data require verified CMS grants", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/sign-in/);
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeVisible();
  expect((await request.post("/api/admin/create", { data: {} })).status()).toBe(
    401,
  );
  expect(
    (
      await request.get("/media/00000000-0000-4000-8000-000000000000?preview=1")
    ).status(),
  ).toBe(401);
  expect((await request.get("/unpublished-notes")).status()).toBe(404);
  const search = await (
    await request.get("/search?q=An%20idea%20still")
  ).text();
  expect(search).not.toContain("An idea still taking shape");
  expect(await (await request.get("/feed.xml")).text()).not.toContain(
    "unpublished-notes",
  );
});
