import { test, expect, type Page } from "@playwright/test";
import { legacyDraft } from "../fixtures/legacy";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../../src/persistence/drafts";
import { PLAYWRIGHT_OWNER_COOKIE } from "../../src/auth/routing";

const firstText = "Built reusable interface components.";
const replacement = "Built reusable interface components with keyboard navigation and visible focus states.";
const first = (page: Page) => page.locator('[data-block-id="block-components"]');
const second = (page: Page) => page.locator('[data-block-id="block-designers"]');
const status = (page: Page) => page.locator(".badge");

async function selectBlock(page: Page, which: "first" | "second") {
  const block = which === "first" ? first(page) : second(page);
  await block.evaluate((element) => {
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function waitForSave(page: Page) {
  await expect(page.getByRole("status")).toHaveText("Saved");
}

test.beforeEach(async ({ context, page }, testInfo) => {
  await context.addCookies([{
    name: PLAYWRIGHT_OWNER_COOKIE,
    value: `${testInfo.workerIndex}-${Date.now()}-${Math.random()}`,
    url: "http://127.0.0.1:3100",
  }]);
  await page.goto("/master");
  await expect(page.getByRole("textbox", { name: "CV content" })).toBeVisible();
});

test("inspect evidence, accept, undo and redo, then reload the autosaved draft", async ({ page }) => {
  await expect(page.getByText("Fixture interview · Answer 1")).toBeVisible();
  await expect(first(page)).toHaveText(firstText);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(first(page)).toHaveText(replacement);
  await expect(status(page)).toHaveText("Accepted");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(first(page)).toHaveText(firstText);
  await expect(status(page)).toHaveText("Pending");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(first(page)).toHaveText(replacement);
  await expect(status(page)).toHaveText("Accepted");
  await waitForSave(page);
  await page.reload();
  await expect(first(page)).toHaveText(replacement);
  await expect(status(page)).toHaveText("Accepted");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("reject and edit a proposal without changing CV text; undo both", async ({ page }) => {
  await page.getByRole("button", { name: "Edit proposed wording" }).click();
  await page.getByLabel("Proposed wording", { exact: true }).fill("Built keyboard-accessible interface components.");
  await page.getByRole("button", { name: "Update proposal" }).click();
  await expect(first(page)).toHaveText(firstText);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(status(page)).toHaveText("Rejected");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(status(page)).toHaveText("Pending");
  await expect(page.locator(".replacement")).toHaveText("Built keyboard-accessible interface components.");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".replacement")).toHaveText(replacement);
  await expect(first(page)).toHaveText(firstText);
});

test("direct editing protects stale targets and undo restores eligibility", async ({ page }) => {
  await first(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Across three products.");
  await expect(status(page)).toHaveText("Needs review");
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeDisabled();
  await expect(page.getByRole("complementary", { name: "Proposal review" }).getByRole("alert")).toContainText("Accept is blocked");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(first(page)).toHaveText(firstText);
  await expect(status(page)).toHaveText("Pending");
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeEnabled();
});

test("bold and italic survive autosave/reload without changing block IDs", async ({ page }) => {
  await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
  await selectBlock(page, "second");
  await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await expect(second(page).locator(".text-bold.text-italic")).toContainText("Worked with");
  await expect(status(page)).toHaveText("Pending");
  await waitForSave(page);
  await page.reload();
  await expect(second(page).locator(".text-bold.text-italic")).toContainText("Worked with");
  await expect(first(page)).toHaveText(firstText);
});

test("rich text controls preserve selection, history, links and saved formatting", async ({ page }) => {
  await selectBlock(page, "second");
  await page.getByLabel("Font", { exact: true }).selectOption("Georgia");
  await page.getByLabel("Font size", { exact: true }).selectOption("20");
  await page.getByLabel("Font color", { exact: true }).fill("#123456");
  await page.getByRole("button", { name: "Underline", exact: true }).click();
  await page.getByRole("button", { name: "Strikethrough", exact: true }).click();
  await page.getByLabel("Alignment", { exact: true }).selectOption("center");
  await page.getByLabel("Line spacing", { exact: true }).selectOption("2");
  await expect(second(page)).toHaveCSS("text-align", "center");
  await expect(second(page)).toHaveCSS("line-height", "30px");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("Link address").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(page.getByRole("form", { name: "Edit link" }).getByRole("alert")).toBeVisible();
  await page.getByLabel("Link address").fill("https://example.com/portfolio");
  await page.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(second(page).locator("a")).toHaveAttribute("href", "https://example.com/portfolio");
  await expect(second(page).locator("a span")).toHaveCSS("font-size", "20px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(second(page).locator("a")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitForSave(page);
  await page.reload();
  await expect(second(page).locator("a")).toHaveAttribute("href", "https://example.com/portfolio");
  await expect(second(page).locator("a span")).toHaveCSS("font-family", "Georgia");
  await expect(second(page).locator("a span")).toHaveCSS("color", "rgb(18, 52, 86)");
  await expect(second(page).locator(".text-underline-strikethrough")).toBeVisible();
  await expect(second(page)).toHaveCSS("text-align", "center");
});

test("document properties are discoverable, saved and undoable; selection restores inspector scope", async ({ page }, testInfo) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await page.getByLabel("Default font", { exact: true }).selectOption("Georgia");
  await page.getByLabel("Page margins", { exact: true }).fill("48");
  await page.getByLabel("Page margins", { exact: true }).press("Enter");
  await expect(page.locator(".paper")).toHaveCSS("padding-top", "48px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".paper")).toHaveCSS("padding-top", "64px");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitForSave(page);
  await page.screenshot({ path: testInfo.outputPath("document-properties.png") });
  await page.reload();
  await expect(page.locator(".paper")).toHaveCSS("padding-top", "48px");
  await expect(page.locator(".paper")).toHaveCSS("font-family", "Georgia");
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await second(page).click();
  await expect(page.getByRole("button", { name: "Selection", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Document properties" })).toBeVisible();
  await expect(page.locator(".element-style-type")).toHaveText("Document");
  for (const label of ["Font color", "Alignment", "Line spacing"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  }
  await expect(page.locator(".font-color")).toHaveCSS("opacity", "0.45");
  await expect(page.locator(".icon-select").first()).toHaveCSS("opacity", "0.45");
  await page.screenshot({ path: testInfo.outputPath("document-toolbar.png") });
  await second(page).click();
  await expect(page.getByRole("button", { name: "Selection", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const label of ["Font color", "Alignment", "Line spacing"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeEnabled();
  }
  const color = page.locator(".font-color");
  const background = await color.evaluate((element) => getComputedStyle(element).backgroundColor);
  await color.hover();
  await expect(color).not.toHaveCSS("background-color", background);
  await page.screenshot({ path: testInfo.outputPath("color-hover.png") });
});

test("document columns offer an optional full-width header, expose layout styling, and preserve placement", async ({ page }, testInfo) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await page.getByLabel("Document columns", { exact: true }).selectOption("inset");
  await page.getByLabel("Full-width Header", { exact: true }).check();

  await expect(page.locator(".cv-header")).toHaveCount(1);
  await expect(page.locator(".cv-column [data-block-id=cv-name]")).toHaveText("Alex Morgan");
  await expect(page.locator(".cv-columns")).toHaveCount(1);
  await expect(page.locator(".cv-column")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Header · Full width", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Columns", exact: true })).toBeVisible();
  await expect(page.locator(".column-resize-handle")).toHaveCount(0);

  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Columns", exact: true })).toBeVisible();
  await page.getByLabel("Column gap", { exact: true }).fill("16");
  await page.getByLabel("Column divider", { exact: true }).selectOption("2");
  await page.getByLabel("Divider color", { exact: true }).fill("#123456");
  await page.locator(".right-sidebar").getByRole("slider", { name: "Column width", exact: true }).fill("60");
  const resizeHandle = page.locator(".column-resize-handle");
  await expect(resizeHandle).toHaveAttribute("aria-valuenow", "60");
  await resizeHandle.press("ArrowRight");
  await expect(resizeHandle).toHaveAttribute("aria-valuenow", "61");
  const handleBox = (await resizeHandle.boundingBox())!;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 18, handleBox.y + handleBox.height / 2);
  await page.mouse.up();
  const draggedRatio = await resizeHandle.getAttribute("aria-valuenow");
  expect(Number(draggedRatio)).toBeGreaterThan(61);

  await page.locator(".outline-select").filter({ hasText: "Column 2" }).click();
  await expect(resizeHandle).toHaveCount(1);
  await page.getByLabel("Region background color", { exact: true }).fill("#17324a");
  await page.getByLabel("Region text color", { exact: true }).fill("#f3f7f8");
  await page.getByLabel("All padding", { exact: true }).fill("16");
  await expect(page.locator(".cv-column").nth(1)).toHaveCSS("background-color", "rgb(23, 50, 74)");
  await expect(page.locator(".cv-column").nth(1)).toHaveCSS("color", "rgb(243, 247, 248)");

  const profile = page.locator('[data-block-id="section-summary"]');
  await page.getByRole("button", { name: "Section · Profile", exact: true }).click();
  await expect(resizeHandle).toHaveCount(1);
  await expect(page.getByLabel("Element column", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Section columns", { exact: true })).toHaveCount(0);
  const profileMoveHandle = page.getByRole("button", { name: "Move Section · Profile — press Space for keyboard move", exact: true });
  const columnTwoOutline = page.locator(".outline-select").filter({ hasText: /^Column 2 ·/ });
  const columnTwoRow = page.locator(".outline-row").filter({ has: columnTwoOutline });
  const columnTwoBox = (await columnTwoRow.boundingBox())!;
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const dropPoint = { clientX: columnTwoBox.x + columnTwoBox.width / 2, clientY: columnTwoBox.y + columnTwoBox.height / 2 };
  await profileMoveHandle.dispatchEvent("dragstart", { dataTransfer });
  await columnTwoRow.dispatchEvent("dragover", { dataTransfer, ...dropPoint });
  await expect(page.locator('.document-drop-line[data-drop-position="inside"]')).toBeVisible();
  await expect(page.locator(".document-drop-container")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("outline-document-drop-feedback.png") });
  await columnTwoRow.dispatchEvent("drop", { dataTransfer, ...dropPoint });
  await profileMoveHandle.dispatchEvent("dragend", { dataTransfer });
  await expect(page.locator(".document-drop-line")).toHaveCount(0);
  await expect(page.locator(".cv-column").nth(1).locator('[data-block-id="section-summary"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".cv-column").nth(0).locator('[data-block-id="section-summary"]')).toHaveCount(1);
  await expect(profile).toHaveCount(1);
  await profileMoveHandle.focus();
  await page.keyboard.press("Space");
  await columnTwoOutline.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cv-column").nth(1).locator('[data-block-id="section-summary"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".cv-column").nth(0).locator('[data-block-id="section-summary"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Header · Full width", exact: true }).click();
  await expect(resizeHandle).toHaveCount(0);
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await expect(resizeHandle).toHaveAttribute("aria-valuenow", draggedRatio!);

  await waitForSave(page);
  await page.locator(".canvas-scroll").evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
  await page.screenshot({ path: testInfo.outputPath("two-column-document.png") });
  await page.reload();
  await expect(page.locator(".cv-header")).toHaveCount(1);
  await expect(page.locator(".cv-column").nth(1)).toHaveCSS("background-color", "rgb(23, 50, 74)");
  await expect(page.locator(".column-resize-handle")).toHaveCount(0);
  await page.getByRole("button", { name: "Section · Profile", exact: true }).click();
  await expect(page.locator(".column-resize-handle")).toHaveAttribute("aria-valuenow", draggedRatio!);
});

test("text styles and numbered lists retain content and stable identities", async ({ page }) => {
  const role = page.locator('[data-block-id="cv-role"]');
  await role.click();
  await page.getByLabel("Text style", { exact: true }).selectOption("subtitle");
  await expect(role).toHaveAttribute("data-text-style", "subtitle");
  await page.getByRole("toolbar", { name: "Text formatting" }).getByRole("button", { name: "Numbered list", exact: true }).click();
  await expect(page.locator('ol [data-block-id="cv-role"]')).toHaveCount(1);
  await page.getByRole("toolbar", { name: "Text formatting" }).getByRole("button", { name: "Numbered list", exact: true }).click();
  await expect(page.locator('p[data-block-id="cv-role"]')).toHaveCount(1);
  await waitForSave(page);
  await page.reload();
  await expect(role).toHaveAttribute("data-text-style", "subtitle");
});

test("splitting creates unique IDs; deleting the target blocks acceptance", async ({ page }) => {
  await first(page).evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();
    let offset = 5;
    while (text && offset > (text.textContent?.length ?? 0)) {
      offset -= text.textContent?.length ?? 0;
      text = walker.nextNode();
    }
    if (!text) throw new Error("Target text was not found.");
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(text, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.press("Enter");
  await expect(page.locator(".cv-input li")).toHaveCount(3);
  const ids = await page.locator(".cv-input li").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.blockId));
  expect(new Set(ids).size).toBe(3);
  expect(ids.every(Boolean)).toBe(true);
  await expect(status(page)).toHaveText("Needs review");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(first(page)).toHaveText(firstText);
  await expect(page.locator(".cv-input li")).toHaveCount(2);
  await page.getByRole("textbox", { name: "CV content" }).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect(first(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeDisabled();
  await expect(page.getByText("Target block was removed.")).toBeVisible();
});

test("paste discards HTML styling, and clean view hides proposal highlights", async ({ page }) => {
  await second(page).click();
  await page.keyboard.press("End");
  // Dispatch a clipboard event because OS clipboard availability varies in CI.
  await page.getByRole("textbox", { name: "CV content" }).evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", " Plain pasted text");
    data.setData("text/html", '<b style="color:red"> Plain pasted text</b>');
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(second(page)).toContainText("Plain pasted text");
  await expect(second(page).locator("b,strong,.text-bold")).toHaveCount(0);
  await page.getByLabel("Clean view").check();
  await expect(page.locator(".paper")).not.toHaveClass(/show-proposal/);
  await page.getByLabel("Clean view").uncheck();
  await expect(page.locator(".paper")).toHaveClass(/show-proposal/);
});

test("desktop and mobile layout stay readable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const toolbar = (await page.getByRole("toolbar", { name: "Text formatting" }).boundingBox())!;
  expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(390);
  const sidebar = (await page.locator(".right-sidebar").boundingBox())!;
  expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});

test("saved editor hydrates without errors and keeps its outline live", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // A full reload exercises SSR with an existing database document. First-time
  // fixture creation only mounts the editor after hydration and misses this bug.
  await page.reload();
  await expect(page.locator(".outline-document")).toHaveText("Document");
  const name = page.locator('[data-block-id="cv-name"]');
  await name.fill("Hydrated CV");
  await expect(page.locator(".outline-select").filter({ hasText: "Hydrated CV" })).toHaveCount(1);
  await waitForSave(page);
  await page.reload();
  await expect(name).toHaveText("Hydrated CV");
  await expect(page.locator(".outline-select").filter({ hasText: "Hydrated CV" })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("outline and document selection stay synchronized", async ({ page }, testInfo) => {
  const firstOutlineRow = page.getByRole("button", { name: "Built reusable interface components.", exact: true });
  await firstOutlineRow.click();
  await expect(firstOutlineRow).toHaveAttribute("aria-pressed", "true");
  await expect(first(page)).toHaveCSS("outline-style", "solid");

  await second(page).click();
  const secondOutlineRow = page.getByRole("button", { name: "Worked with designers to improve product interfaces.", exact: true });
  await expect(secondOutlineRow).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Properties" }).click();
  const elementPanel = page.locator(".element-panel");
  await expect(elementPanel.getByRole("heading", { name: "Bullet", exact: true })).toBeVisible();
  await expect(elementPanel.getByText("Worked with designers to improve product interfaces.", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("properties-panel.png") });
});

test("document selection opens the outline and reveals the selected element", async ({ page }) => {
  await page.locator('.outline-row[data-outline-row="section-experience"] .outline-disclosure').click();
  await expect(page.getByRole("button", { name: "Expand Section · Experience" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("tab", { name: "Chat" }).click();
  await page.getByRole("button", { name: "Collapse left sidebar" }).click();

  await second(page).click();

  await expect(page.getByRole("tab", { name: "Outline" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Collapse Section · Experience" })).toHaveAttribute("aria-expanded", "true");
  const selected = page.getByRole("button", { name: "Worked with designers to improve product interfaces.", exact: true });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => {
    const row = await selected.boundingBox();
    const viewport = await page.getByRole("complementary", { name: "Document navigation" }).locator(".sidebar-scroll").boundingBox();
    return Boolean(row && viewport && row.y >= viewport.y && row.y + row.height <= viewport.y + viewport.height);
  }).toBe(true);
});

test("outline disclosure rotates without shifting position", async ({ page }, testInfo) => {
  const disclosure = page.locator(".outline-disclosure").first();
  const icon = disclosure.locator("svg");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  const expanded = await icon.boundingBox();
  expect(expanded).not.toBeNull();

  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  const collapsed = await icon.boundingBox();
  expect(collapsed).not.toBeNull();
  expect(Math.abs((expanded!.x + expanded!.width / 2) - (collapsed!.x + collapsed!.width / 2))).toBeLessThan(0.1);
  expect(Math.abs((expanded!.y + expanded!.height / 2) - (collapsed!.y + collapsed!.height / 2))).toBeLessThan(0.1);
  await page.screenshot({ path: testInfo.outputPath("collapsed-outline-disclosure.png") });
});

test("outline supports arrow-key tree navigation", async ({ page }) => {
  const document = page.getByRole("button", { name: "Document", exact: true });
  const name = page.getByRole("button", { name: "Alex Morgan", exact: true });
  const role = page.getByRole("button", { name: "Frontend Engineer", exact: true });
  const experience = page.getByRole("button", { name: "Section · Experience", exact: true });
  const experienceHeading = page.getByRole("button", { name: "Experience", exact: true });

  await document.focus();
  await page.keyboard.press("ArrowDown");
  await expect(name).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(role).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(name).toBeFocused();

  await experience.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Expand Section · Experience" })).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Collapse Section · Experience" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowRight");
  await expect(experienceHeading).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(experience).toBeFocused();
});

test("tooltips identify elements and actions without disturbing editing", async ({ page }, testInfo) => {
  const outlineRow = page.getByRole("button", { name: "Built reusable interface components.", exact: true });
  await outlineRow.locator(".outline-type").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Bullet");
  await page.screenshot({ path: testInfo.outputPath("element-tooltip.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await outlineRow.locator("span").last().hover();
  // Wait past the hover delay to ensure the text is not another trigger.
  await page.waitForTimeout(500);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await selectBlock(page, "second");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await bold.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Bold⌘B");
  await bold.click();
  await expect(second(page).locator(".text-bold")).toContainText("Worked with");
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  await selectBlock(page, "second");
  await page.keyboard.press("ControlOrMeta+Shift+x");
  await expect(second(page).locator(".text-strikethrough")).toContainText("Worked with");
  const strikethrough = page.getByRole("button", { name: "Strikethrough", exact: true });
  await strikethrough.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Strikethrough⇧⌘X");
  await page.screenshot({ path: testInfo.outputPath("formatting-shortcut-tooltip.png") });
});

test("workspace sidebars collapse and the chat shell stays available", async ({ page }) => {
  const left = page.getByRole("complementary", { name: "Document navigation" });
  const right = page.getByRole("complementary", { name: "Editor panels" });
  await page.getByRole("tab", { name: "Chat" }).click();
  await expect(page.getByRole("heading", { name: "Interview chat" })).toBeVisible();
  const openLeftWidth = (await left.boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse left sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand left sidebar" })).toBeVisible();
  await expect.poll(async () => (await left.boundingBox())!.width).toBeLessThan(openLeftWidth);
  const openRightWidth = (await right.boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse right sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand right sidebar" })).toBeVisible();
  await expect.poll(async () => (await right.boundingBox())!.width).toBeLessThan(openRightWidth);
});

test("zoom changes the A4 page scale and the canvas contains overflow", async ({ page }) => {
  const paper = page.locator(".paper");
  const initial = await paper.boundingBox();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Zoom 100 percent" })).toBeVisible();
  await expect.poll(async () => (await paper.boundingBox())!.width).toBeGreaterThan(initial!.width);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Zoom 200 percent" })).toBeVisible();
  const overflow = await page.locator(".canvas-scroll").evaluate((element) => ({
    horizontal: element.scrollWidth > element.clientWidth,
    vertical: element.scrollHeight > element.clientHeight,
  }));
  expect(overflow).toEqual({ horizontal: true, vertical: true });
});

test("merging bullets retains the surviving ID and is reversible", async ({ page }) => {
  await second(page).click({ position: { x: 8, y: 8 } });
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  // Lexical first removes the bullet, then a second Backspace merges blocks.
  await expect(page.locator(".cv-input li")).toHaveCount(1);
  await expect(second(page)).toHaveText("Worked with designers to improve product interfaces.");
  await expect(second(page)).toHaveJSProperty("tagName", "P");
  await page.keyboard.press("Backspace");
  await expect(first(page)).toContainText("Worked with designers");
  await expect(status(page)).toHaveText("Needs review");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(second(page)).toHaveText("Worked with designers to improve product interfaces.");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".cv-input li")).toHaveCount(2);
  await expect(first(page)).toHaveText(firstText);
  await expect(second(page)).toHaveText("Worked with designers to improve product interfaces.");
  await expect(status(page)).toHaveText("Pending");
});

test("keyboard undo/redo restores an accepted proposal", async ({ page }) => {
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await first(page).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(first(page)).toHaveText(firstText);
  await expect(status(page)).toHaveText("Pending");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(first(page)).toHaveText(replacement);
  await expect(status(page)).toHaveText("Accepted");
});

test("plain-text paste preserves line breaks after reload", async ({ page }) => {
  await second(page).click();
  await page.keyboard.press("End");
  await page.getByRole("textbox", { name: "CV content" }).evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "\nAdditional line");
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(second(page).locator("br")).toHaveCount(1);
  await waitForSave(page);
  await page.reload();
  await expect(second(page).locator("br")).toHaveCount(1);
  await expect(second(page)).toContainText("Additional line");
});

test("a failed autosave is visible and does not claim changes were saved", async ({ page }) => {
  await page.route("**/*", async (route) => route.request().method() === "POST" ? route.abort() : route.continue());
  await first(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Updated.");
  await expect(page.getByRole("status")).toHaveText("Changes not saved");
  await expect(page.getByText("Couldn't save to the database.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save version", exact: true })).toHaveCount(0);
  await expect(first(page)).toContainText("Updated.");
});

test("paragraph and bullet conversion preserves content identity", async ({ page }) => {
  await first(page).click();
  await page.getByRole("button", { name: "Make text", exact: true }).click();
  await expect(first(page)).toHaveJSProperty("tagName", "P");
  await expect(first(page)).toHaveText(firstText);
  await expect(status(page)).toHaveText("Needs review");
  await first(page).click();
  await page.getByRole("button", { name: "Make bullet", exact: true }).click();
  await expect(first(page)).toHaveJSProperty("tagName", "LI");
  await expect(status(page)).toHaveText("Pending");
  await waitForSave(page);
  await page.reload();
  await expect(first(page)).toHaveText(firstText);
});


test("name, contact, headings, entry titles and dates edit and persist in the document", async ({ page }) => {
  const edits = [
    ["cv-name", "Alex Rivera"],
    ["cv-contact", "Paris · alex.rivera@example.com"],
    ["heading-experience", "Selected experience"],
    ["heading-northstar", "Senior Engineer · Northstar Studio"],
    ["dates-northstar", "2023–Present · Remote"],
    ["heading-degree", "BSc Software Engineering · Example University"],
  ];
  const idsBefore = await page.locator(".cv-input [data-block-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.blockId));
  for (const [id, text] of edits) {
    const element = page.locator(`[data-block-id="${id}"]`);
    await element.fill(text);
    await expect(element).toHaveText(text);
  }
  await expect(status(page)).toHaveText("Pending");
  await waitForSave(page);
  await page.reload();
  for (const [id, text] of edits) await expect(page.locator(`[data-block-id="${id}"]`)).toHaveText(text);
  const idsAfter = await page.locator(".cv-input [data-block-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.blockId));
  expect(idsAfter).toEqual(idsBefore);
  await expect(page.locator(".document-title")).toHaveText("Alex Rivera");
});

test("heading edits and proposal review share one history", async ({ page }) => {
  const name = page.locator('[data-block-id="cv-name"]');
  await name.fill("Alex Updated");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(name).toHaveText("Alex Updated");
  await expect(status(page)).toHaveText("Pending");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(name).toHaveText("Alex Morgan");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(name).toHaveText("Alex Updated");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(status(page)).toHaveText("Accepted");
});

test("add a section and entry with unique IDs, undo/redo and reload", async ({ page }) => {
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  const section = page.locator(".cv-section").last();
  await section.locator("h2").fill("Projects");
  const sectionId = await section.getAttribute("data-block-id");
  await section.locator("h2").click();
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  const entry = section.locator(".cv-entry");
  await expect(entry).toHaveCount(1);
  const entryId = await entry.getAttribute("data-block-id");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(entry).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(entry).toHaveAttribute("data-block-id", entryId!);
  await entry.locator("h3").fill("CV editor project");
  await entry.locator("p").fill("Built an evidence-backed CV editor.");
  await waitForSave(page);
  await page.reload();
  await expect(page.locator(`[data-block-id="${sectionId}"] h2`)).toHaveText("Projects");
  await expect(page.locator(`[data-block-id="${entryId}"] h3`)).toHaveText("CV editor project");
  await expect(page.locator(`[data-block-id="${entryId}"] p`)).toHaveText("Built an evidence-backed CV editor.");
  const ids = await page.locator(".cv-input [data-block-id]").evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.blockId));
  expect(ids.every(Boolean)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
});

test("delete the complete CV then undo restores every element and review status", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "CV content" });
  const before = await editor.innerText();
  await page.locator('[data-block-id="cv-name"]').click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await expect(editor).not.toContainText("Alex Morgan");
  await expect(page.locator(".cv-section")).toHaveCount(0);
  await expect(status(page)).toHaveText("Needs review");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => editor.innerText()).toBe(before);
  await expect(page.locator('[data-block-id="cv-name"]')).toHaveText("Alex Morgan");
  await expect(page.locator(".cv-section")).toHaveCount(3);
  await expect(status(page)).toHaveText("Pending");
});

test("existing local drafts and versions migrate once into the autosaved database draft", async ({ context, page }) => {
  const old = legacyDraft();
  const legacy = { schemaVersion: 1, master: old, draft: old, versions: [{ id: "saved-before-upgrade", savedAt: "2026-09-22", draft: old }] };
  await page.evaluate(({ key, currentKey, value }) => { localStorage.removeItem(currentKey); localStorage.setItem(key, JSON.stringify(value)); }, { key: LEGACY_STORAGE_KEY, currentKey: STORAGE_KEY, value: legacy });
  await context.addCookies([{ name: PLAYWRIGHT_OWNER_COOKIE, value: `legacy-${Date.now()}`, url: "http://127.0.0.1:3100" }]);
  await page.reload();
  await expect(second(page)).toHaveText("My existing draft edit.");
  await expect(second(page).locator(".text-bold")).toHaveText("My existing draft edit.");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.locator(`[data-block-id="${old.cv.id}-name"]`)).toHaveText("Alex Morgan");
  await expect(page.getByRole("button", { name: "Save version", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_STORAGE_KEY)).toBeNull();
  await page.reload();
  await expect(second(page)).toHaveText("My existing draft edit.");
});

test("a stale tab cannot overwrite a newer database revision", async ({ context, page }) => {
  const stalePage = await context.newPage();
  await stalePage.goto("/master");
  await expect(stalePage.getByRole("textbox", { name: "CV content" })).toBeVisible();

  await first(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Newer edit.");
  await waitForSave(page);

  await first(stalePage).click();
  await stalePage.keyboard.press("End");
  await stalePage.keyboard.type(" Stale edit.");
  await expect(stalePage.getByRole("status")).toHaveText("Reload required");
  await expect(stalePage.getByText("This document changed in another tab", { exact: false })).toBeVisible();

  await page.reload();
  await expect(first(page)).toContainText("Newer edit.");
  await expect(first(page)).not.toContainText("Stale edit.");
});

test("focus follows individual elements without changing layout or document history", async ({ page }, testInfo) => {
  const name = page.locator('[data-block-id="cv-name"]');
  const editor = page.getByRole("textbox", { name: "CV content" });
  const originalBounds = await first(page).boundingBox();
  await name.click();
  await expect(name).toHaveCSS("outline-style", "solid");
  await expect(editor).toHaveCSS("outline-style", "none");
  await first(page).click();
  await expect(first(page)).toHaveCSS("outline-width", "1px");
  await expect(name).toHaveCSS("outline-style", "none");
  expect(await first(page).boundingBox()).toEqual(originalBounds);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await first(page).screenshot({ path: testInfo.outputPath("active-bullet.png") });
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  await expect(second(page)).toHaveCSS("outline-style", "solid");
  await expect(first(page)).toHaveCSS("outline-style", "none");
  await page.keyboard.press("ControlOrMeta+a");
  await expect(second(page)).toHaveCSS("outline-style", "none");
  await expect(name).toHaveCSS("outline-style", "none");
});

test("formatting keeps the active element and selected text", async ({ page }, testInfo) => {
  const name = page.locator('[data-block-id="cv-name"]');
  await name.click({ clickCount: 2, position: { x: 14, y: 14 } });
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await expect(name.locator(".text-italic")).toHaveText("Alex");
  await expect(page.locator('[data-block-id="cv-role"] .text-italic')).toHaveCount(0);
  await expect(name).toHaveCSS("outline-style", "solid");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Collapse right sidebar" }).click();
  await page.screenshot({ path: testInfo.outputPath("active-heading-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(name.locator(".text-italic")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("formatting toolbar stays stable and disables text controls for groups", async ({ page }) => {
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Bold", exact: true })).toBeDisabled();
  await page.locator('[data-block-id="cv-name"]').click();
  const headingToolbar = toolbar;
  await expect(headingToolbar).toBeVisible();
  await expect(headingToolbar.getByRole("button", { name: "Bold" })).toBeVisible();
  await expect(headingToolbar.getByRole("button", { name: "Italic" })).toBeVisible();
  await expect(headingToolbar.getByRole("button", { name: "Bold", exact: true })).toBeEnabled();

  await page.getByRole("button", { name: "Section · Profile", exact: true }).click();
  await expect(toolbar.getByRole("button", { name: "Bold", exact: true })).toBeDisabled();
  await expect(toolbar.getByRole("button", { name: "Italic", exact: true })).toBeDisabled();
});

test("sidebars resize by dragging while retaining canvas space", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const left = page.locator(".left-sidebar");
  const handle = page.getByRole("separator", { name: "Resize left sidebar" });
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 200);
  await page.mouse.down();
  await page.mouse.move(1100, bounds.y + 200, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await left.boundingBox())!.width)).toBe(720);
  const right = page.getByRole("separator", { name: "Resize right sidebar" });
  await right.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => Math.round((await page.locator(".right-sidebar").boundingBox())!.width)).toBe(340);
  expect((await page.locator(".editor-center").boundingBox())!.width).toBeGreaterThanOrEqual(240);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("resized-sidebars.png") });
});


test("page regions support independent padding, primary order and saved geometry", async ({ page }, testInfo) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await page.getByLabel("Document columns", { exact: true }).selectOption("page");
  await expect(page.locator(".cv-header")).toHaveCount(0);
  await expect(page.getByLabel("Page margins", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Full-height columns", exact: true }).click();
  await page.getByLabel("Column gap", { exact: true }).fill("0");
  await page.getByLabel("Column divider", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Swap column positions", exact: true }).click();
  await expect(page.locator(".cv-column").nth(1).locator("[data-block-id=cv-name]")).toHaveText("Alex Morgan");
  await page.locator(".outline-select").filter({ hasText: /^Column 1 ·/ }).click();
  await page.getByLabel("Column label", { exact: true }).fill("Sidebar");
  await page.getByLabel("Region background color", { exact: true }).fill("#17324a");
  await page.getByLabel("Region text color", { exact: true }).fill("#ffffff");
  await page.getByLabel("Padding left", { exact: true }).fill("24");
  await page.getByLabel("Padding top", { exact: true }).fill("64");
  await expect(page.locator(".cv-column").first()).toHaveCSS("padding-left", "24px");
  const paper = await page.locator(".paper").boundingBox();
  const sidebar = await page.locator(".cv-column").first().boundingBox();
  expect(sidebar!.x).toBeCloseTo(paper!.x, 0);
  expect(sidebar!.y).toBeCloseTo(paper!.y, 0);
  expect(sidebar!.height).toBeCloseTo(paper!.height, 0);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.locator(".canvas-scroll").evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
  await page.screenshot({ path: testInfo.outputPath("page-regions.png") });
  await page.reload();
  await expect(page.locator(".cv-column").first()).toHaveCSS("padding-top", "64px");
  await expect(page.locator(".cv-column").nth(1).locator("[data-block-id=cv-name]")).toHaveText("Alex Morgan");
});


test("sidebar preset keeps content and primary identity; region boundaries and conversion are undoable", async ({ page }, testInfo) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await page.getByRole("button", { name: "Sidebar left", exact: true }).click();
  await expect(page.locator(".cv-column").nth(1).locator("[data-block-id=cv-name]")).toHaveText("Alex Morgan");
  const name = page.locator("[data-block-id=cv-name]");
  await name.click();
  await name.evaluate((element) => {
    const range = document.createRange();
    range.setStart(element.querySelector("span")?.firstChild ?? element.firstChild!, 0);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.press("Backspace");
  await expect(page.locator(".cv-column")).toHaveCount(2);
  await expect(name).toHaveText("Alex Morgan");
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await page.getByRole("button", { name: "Sidebar right", exact: true }).click();
  await expect(page.locator(".cv-column").first().locator("[data-block-id=cv-name]")).toHaveText("Alex Morgan");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".cv-column").nth(1).locator("[data-block-id=cv-name]")).toHaveText("Alex Morgan");
  await page.getByRole("button", { name: "Document", exact: true }).last().click();
  await page.getByLabel("Document columns", { exact: true }).selectOption("single");
  await expect(page.locator(".cv-columns")).toHaveCount(0);
  await expect(page.locator(".cv-input > [data-block-id=cv-name]")).toHaveText("Alex Morgan");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".cv-column")).toHaveCount(2);
  await page.locator(".canvas-scroll").evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
  const contactMove = page.locator('.outline-row[data-outline-row="cv-contact"] .outline-drag-handle');
  await contactMove.focus();
  await page.keyboard.press("Space");
  await page.locator(".outline-select").filter({ hasText: /^Sidebar ·/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cv-column").first().locator("[data-block-id=cv-contact]")).toHaveText("Berlin, Germany · alex@example.com");
  await page.locator(".canvas-scroll").evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
  await page.screenshot({ path: testInfo.outputPath("sidebar-preset.png") });
});

test("standalone dividers can be inserted, undone, saved and deleted", async ({ page }, testInfo) => {
  const toolbar = page.getByRole("toolbar", { name: "Add element", exact: true });
  await expect(toolbar).toHaveText("SectionEntryDivider");
  await expect(page.locator(".cv-input h2").first()).toHaveCSS("border-bottom-width", "0px");
  await page.locator(".cv-input h2").first().click();
  await toolbar.getByRole("button", { name: "Add divider" }).click();
  const divider = page.getByRole("separator", { name: "Divider", exact: true });
  await expect(divider).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Divider", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(divider).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(divider).toHaveCount(1);
  await waitForSave(page);
  await page.reload();
  await expect(divider).toHaveCount(1);
  await divider.click();
  await page.screenshot({ path: testInfo.outputPath("divider-toolbar.png") });
  await page.keyboard.press("Delete");
  await expect(divider).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(divider).toHaveCount(1);
});

test("divider properties support color formats, wheel, opacity, thickness and ends", async ({ page }, testInfo) => {
  await page.locator(".cv-input h2").first().click();
  await page.getByRole("button", { name: "Add divider", exact: true }).click();
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  const divider = page.getByRole("separator", { name: "Divider", exact: true });
  const hex = page.getByRole("textbox", { name: "Color hex", exact: true });
  await hex.fill("#2468ac");
  await hex.press("Enter");
  await expect(divider).toHaveCSS("--cv-divider-color", "#2468ac");
  const opacity = page.getByRole("spinbutton", { name: "Opacity", exact: true });
  await opacity.fill("45");
  await opacity.press("Enter");
  await expect(divider).toHaveCSS("--cv-divider-opacity", "0.45");
  const thickness = page.getByRole("spinbutton", { name: "Thickness", exact: true });
  await thickness.fill("24");
  await expect(divider).toHaveCSS("--cv-divider-thickness", "24px");
  await expect(thickness).toBeFocused();
  await page.getByRole("combobox", { name: "Ends", exact: true }).selectOption("rounded");
  await expect(divider).toHaveCSS("--cv-divider-radius", "999px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(divider).toHaveCSS("--cv-divider-radius", "0px");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(divider).toHaveCSS("--cv-divider-radius", "999px");
  await page.screenshot({ path: testInfo.outputPath("divider-line-controls.png") });
  await page.getByRole("button", { name: "Choose color", exact: true }).click();
  await page.getByRole("spinbutton", { name: "R", exact: true }).fill("128");
  await page.getByRole("spinbutton", { name: "R", exact: true }).press("Enter");
  await expect(hex).toHaveValue("8068AC");
  const wheel = page.getByRole("slider", { name: "Color wheel", exact: true });
  await wheel.click({ position: { x: 150, y: 80 } });
  await expect(hex).not.toHaveValue("8068AC");
  await wheel.press("ArrowRight");
  await page.getByRole("slider", { name: "Color brightness", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  const wheelBeforeBlack = await wheel.getAttribute("aria-valuetext");
  await page.keyboard.press("Home");
  await expect(hex).toHaveValue("000000");
  await page.keyboard.press("End");
  await expect(wheel).toHaveAttribute("aria-valuetext", wheelBeforeBlack!);
  await page.screenshot({ path: testInfo.outputPath("divider-properties.png") });
  const savedColor = await hex.inputValue();
  await page.getByRole("heading", { name: "Line style", exact: true }).click();
  await expect(page.getByRole("group", { name: "Color picker", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Choose color", exact: true })).toHaveAttribute("aria-expanded", "false");
  await thickness.fill("201");
  await thickness.press("Tab");
  await expect(thickness).toHaveValue("24");
  await thickness.fill("200");
  await thickness.press("Enter");
  await expect(divider).toHaveCSS("--cv-divider-thickness", "200px");
  await opacity.fill("0");
  await opacity.press("Enter");
  await expect(divider).toHaveCSS("--cv-divider-opacity", "0");
  await waitForSave(page);
  await page.reload();
  await divider.click();
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await expect(hex).toHaveValue(savedColor);
  await expect(opacity).toHaveValue("0");
  await expect(thickness).toHaveValue("200");
  await expect(page.getByRole("combobox", { name: "Ends", exact: true })).toHaveValue("rounded");
});

test("adjacent multi-selection adjusts shared gaps with overlays, undo and persistence", async ({ page }) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  const rows = page.locator('.outline-select');
  await rows.filter({ hasText: firstText }).click();
  await page.locator('[data-outline-id="block-designers"]').click({ modifiers: ["Shift"] });
  const gap = page.getByRole("spinbutton", { name: "Gap between", exact: true });
  await expect(gap).toHaveValue("9");
  await gap.fill("24");
  await expect(second(page)).toHaveCSS("margin-top", "24px");
  await expect(page.locator('.spacing-band.gap.active')).toHaveCount(1);
  await gap.press("Enter");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(second(page)).toHaveCSS("margin-top", "9px");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(second(page)).toHaveCSS("margin-top", "24px");
  await waitForSave(page);
  await page.reload();
  await expect(second(page)).toHaveCSS("margin-top", "24px");
  await second(page).click();
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Space above", exact: true })).toHaveValue("24");
  await first(page).click();
  await expect(page.getByRole("spinbutton", { name: "Space below", exact: true })).toHaveValue("24");
  await page.getByRole("spinbutton", { name: "Space below", exact: true }).focus();
  await page.screenshot({ path: "test-results/spacing-gap.png", fullPage: true });
});

test("list spacing and padding use unitless controls and distinct visual overlays", async ({ page }) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  const listId = await first(page).evaluate((element) => element.parentElement!.dataset.blockId);
  await page.locator(`[data-outline-id="${listId}"]`).click();
  await page.getByRole("spinbutton", { name: "Item spacing", exact: true }).fill("20");
  await expect(second(page)).toHaveCSS("margin-top", "20px");
  await page.getByRole("button", { name: "Document", exact: true }).first().click();
  await page.getByLabel("Document columns", { exact: true }).selectOption("page");
  const columnId = await page.locator('.cv-column').first().getAttribute('data-block-id');
  await page.locator(`[data-outline-id="${columnId}"]`).click();
  await page.getByRole("spinbutton", { name: "All padding", exact: true }).fill("24");
  await expect(page.locator('.spacing-band.padding.active')).toHaveCount(4);
  await expect(page.locator('.cv-column').first()).toHaveCSS("padding-top", "24px");
  await page.getByRole("spinbutton", { name: "Padding top", exact: true }).fill("40");
  await expect(page.locator('.spacing-band.padding.active')).toHaveCount(1);
  await expect(page.getByRole("spinbutton", { name: "All padding", exact: true })).toHaveAttribute("placeholder", "Mixed");
  await page.locator(".canvas-scroll").evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: "test-results/spacing-padding.png", fullPage: true });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('.cv-column').first()).toHaveCSS("padding-top", "24px");
  const paddingHandle = page.getByRole("slider", { name: /^Padding top handle/ });
  await paddingHandle.scrollIntoViewIfNeeded();
  const paddingBox = await paddingHandle.boundingBox();
  expect(paddingBox).not.toBeNull();
  await page.mouse.move(paddingBox!.x + paddingBox!.width / 2, paddingBox!.y + paddingBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(paddingBox!.x + paddingBox!.width / 2, paddingBox!.y + paddingBox!.height / 2 + 16, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.cv-column').first()).toHaveCSS("padding-top", "44px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('.cv-column').first()).toHaveCSS("padding-top", "24px");
  await expect(page.locator('.cv-column').first().locator(':scope > [data-block-id]').first()).toHaveCSS("margin-top", "0px");
  await waitForSave(page);
  await page.reload();
  await expect(page.locator('.cv-column').first()).toHaveCSS("padding-top", "24px");
});

test("canvas gap drag is one undo step and nonadjacent selection never offers distribution", async ({ page }) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  await first(page).click();
  const handle = page.getByRole("slider", { name: /^Space below handle/ });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 24, { steps: 8 });
  await page.mouse.up();
  await expect(second(page)).toHaveCSS("margin-top", "39px");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(second(page)).toHaveCSS("margin-top", "9px");
  await page.locator('[data-outline-id="block-components"]').click();
  await page.locator('.outline-select').filter({ hasText: "Alex Morgan" }).click({ modifiers: ["ControlOrMeta"] });
  await expect(page.getByRole("spinbutton", { name: "Gap between", exact: true })).toHaveCount(0);
  await expect(page.getByText("Select adjacent elements in the same container to adjust their gaps together.")).toBeVisible();
});

test("mixed spacing only equalizes on edit and canvas modifiers preserve multi-selection", async ({ page }) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).click();
  const topRows = page.locator('.outline-select');
  await topRows.filter({ hasText: "Alex Morgan" }).click();
  await topRows.filter({ hasText: "Berlin, Germany · alex@example.com" }).click({ modifiers: ["Shift"] });
  const gap = page.getByRole("spinbutton", { name: "Gap between", exact: true });
  await expect(gap).toHaveValue("");
  await expect(gap).toHaveAttribute("placeholder", "Mixed");
  await gap.fill("18");
  await expect(page.locator('.spacing-band.gap.active')).toHaveCount(2);
  await gap.press("Enter");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(gap).toHaveValue("");
  await first(page).click();
  await expect(page.locator('[data-outline-id="block-components"]')).toHaveAttribute("aria-pressed", "true");
  await second(page).click({ modifiers: ["ControlOrMeta"] });
  await expect(gap).toHaveValue("9");
  await gap.fill("0");
  await gap.press("Enter");
  await expect(second(page)).toHaveCSS("margin-top", "0px");
  const ruler = page.getByRole("slider", { name: /^Gap between handle/ });
  await ruler.focus();
  await ruler.press("ArrowUp");
  await expect(second(page)).toHaveCSS("margin-top", "1px");
});
