import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PLAYWRIGHT_OWNER_COOKIE } from "../../src/auth/routing";

async function useFreshOwner(context: BrowserContext, suffix: string) {
  await context.addCookies([{
    name: PLAYWRIGHT_OWNER_COOKIE,
    value: `applications-${suffix}-${Date.now()}-${Math.random()}`,
    url: "http://127.0.0.1:3100",
  }]);
}

async function createApplication(page: Page, company: string, role: string) {
  await page.getByLabel("Company").fill(company);
  await page.getByLabel("Role").fill(role);
  await page.getByLabel("Job description").fill(`We are hiring a ${role} to build accessible products with our cross-functional team.`);
  await page.getByRole("button", { name: "Create tailored draft" }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]+$/);
}

test("create two applications for one company from an independent master CV", async ({ context, page }, testInfo) => {
  await useFreshOwner(context, "grouping");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
  await expect(page.getByText("No applications yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create tailored draft" })).toBeDisabled();

  await page.getByRole("link", { name: "Create master CV" }).click();
  await expect(page.locator(".document-title")).toHaveText("Alex Morgan");
  const sourceBullet = page.locator('[data-block-id="block-components"]');
  await sourceBullet.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Master source.");
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByRole("link", { name: "Applications" }).click();
  await createApplication(page, "Acme Labs", "Frontend Engineer");
  await expect(page.getByText("Acme Labs · Frontend Engineer")).toBeVisible();
  await expect(sourceBullet).toContainText("Master source.");
  await sourceBullet.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Tailored only.");
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByRole("link", { name: "Applications" }).click();
  await createApplication(page, "  ACME   LABS  ", "Product Engineer");
  await expect(sourceBullet).toContainText("Master source.");
  await expect(sourceBullet).not.toContainText("Tailored only.");

  await page.getByRole("link", { name: "Applications" }).click();
  await expect(page.getByRole("heading", { name: "Acme Labs" })).toHaveCount(1);
  await expect(page.getByText("2 applications")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Frontend Engineer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product Engineer" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("applications-grouped.png"), fullPage: true });
});

test("application home is readable on desktop and mobile", async ({ context, page }, testInfo) => {
  await useFreshOwner(context, "visual");
  await page.goto("/master");
  await expect(page.getByRole("textbox", { name: "CV content" })).toBeVisible();
  await page.goto("/");
  await page.setViewportSize({ width: 1360, height: 1000 });
  await expect(page.getByLabel("Job description")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("applications-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name: "Create tailored draft" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("applications-mobile.png"), fullPage: true });
});
