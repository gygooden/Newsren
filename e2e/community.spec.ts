import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AGENT } from "./helpers";

const view = {
  pulse: { "affects-job|worker|santa-clara-ca": 3, "affects-job|educator|stanislaus-ca": 1 },
  notes: [{ id: "n1", text: "Our plant posted the notice in the break room.", role: "worker", county: "santa-clara-ca", name: "Dana", createdAt: "2026-10-26T10:00:00Z" }],
};

test("story community: see local voices, react and send a note for review", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "newsren.watch",
      JSON.stringify({ topics: ["labor"], organizations: "", questions: "", depth: "professional", county: "santa-clara-ca" }),
    );
  });
  const sent: Record<string, unknown>[] = [];
  await page.route(`${AGENT}/community/**`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sent.push(body);
    const path = new URL(route.request().url()).pathname;
    const reply =
      path.endsWith("/pulse")
        ? { counted: true, pulse: { ...view.pulse, "affects-job|worker|santa-clara-ca": 4 } }
        : path.endsWith("/note")
          ? { ok: true, message: "Thanks. Your note will appear after a moderator reviews it." }
          : view;
    await route.fulfill({ status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(reply) });
  });

  await page.goto("story/layoffs/");
  await expect(page.getByRole("heading", { name: "What readers near you are saying" })).toBeVisible();
  await expect(page.getByText("Dana, Worker in Santa Clara County, California")).toBeVisible();
  await expect(page.getByText("3 near you")).toBeVisible();

  await page.getByRole("button", { name: /This affects my job/ }).click();
  await expect(page.getByRole("button", { name: /This affects my job/ })).toHaveAttribute("aria-pressed", "true");
  expect(sent.find((b) => b.reaction === "affects-job")).toMatchObject({ role: "worker", county: "santa-clara-ca" });

  await page.getByLabel("Your note").fill("The county job center is offering retraining sessions.");
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText("Your note will appear after a moderator reviews it.")).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});
