import { expect, test } from "@playwright/test";
import { mockWorkerOk, tabTo } from "./helpers";

test("keyboard only: complete the watch form, run live research, switch story tabs", async ({ page }) => {
  await mockWorkerOk(page);
  await page.goto("watch/");

  await tabTo(page, "#topic-labor");
  await page.keyboard.press("Space");
  await expect(page.locator("#topic-labor")).toBeChecked();

  await tabTo(page, "#organizations");
  await page.keyboard.type("Orchard Semiconductor");

  await tabTo(page, "#depth-student");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#depth-educator")).toBeChecked();

  await tabTo(page, "#county");
  await page.keyboard.type("Santa");
  await expect(page.locator("#county")).toHaveValue("santa-clara-ca");

  await tabTo(page, "button[type=submit]");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/briefing\/$/);

  await tabTo(page, "#run-live");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Live briefing" })).toBeVisible();
  await expect(page.getByText("Searching Federal Register")).toBeVisible();
  await expect(page.getByText("Live runs remaining today: 2.")).toBeVisible();
  await expect(page.getByText("AI-generated, not editor-reviewed").first()).toBeVisible();

  await page.goto("story/layoffs/");
  await tabTo(page, "[role=tab][aria-selected=true]");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Learn this topic" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Learn this topic" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Follow developments" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Connected stories" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Follow developments" })).toBeFocused();
});
