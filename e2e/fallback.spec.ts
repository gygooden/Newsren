import { expect, test } from "@playwright/test";
import { mockWorker429 } from "./helpers";

test("a 429 from the Worker shows the saved briefing with the limit message", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "newsren.watch",
      JSON.stringify({ topics: ["labor"], organizations: "", questions: "", depth: "student", county: "santa-clara-ca" }),
    );
  });
  await mockWorker429(page);
  await page.goto("briefing/");
  await page.getByRole("button", { name: "Run live research" }).click();
  await expect(
    page.getByText("Today's live research limit has been reached. Showing the most recent saved briefing."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Saved briefing/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reports and documents" })).toBeVisible();
});
