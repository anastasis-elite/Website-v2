// Opt-in local component QA. Requires the temporary fixture and an installed Playwright runtime.
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.DASHBOARD_QA_URL || "http://127.0.0.1:3100";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))
  throw new Error("Only an isolated localhost fixture is allowed.");
const output = resolve("docs/screenshots/ignite-stability");
mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    for (const [device, viewport] of [
      ["mobile", { width: 390, height: 844 }],
      ["desktop", { width: 1440, height: 1000 }],
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin === base ? route.continue() : route.abort();
      });
      const go = async (view, tier = "ignite", hash = "") => {
        await page.goto(
          `${base}/local-dashboard-qa?view=${view}&tier=${tier}${hash}`,
        );
        await page
          .getByText("Loading isolated local QA fixture…")
          .waitFor({ state: "hidden" });
        await page.waitForTimeout(150);
      };
      const button = (name) =>
        page
          .locator("button")
          .filter({ hasText: new RegExp("^" + name + "$", "i") });
      const check = async (name) => {
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${device} ${name} overflows`,
        );
        const clipped = await page
          .locator(".client-dashboard-nav small")
          .evaluateAll((nodes) =>
            nodes
              .filter(
                (n) =>
                  n.getClientRects().length &&
                  n.scrollWidth > n.clientWidth + 1,
              )
              .map((n) => n.textContent),
          );
        assert.deepEqual(clipped, [], device + " clipped navigation labels");
        await page.screenshot({
          path: resolve(output, `${device}-${name}.jpg`),
          fullPage: true,
          type: "jpeg",
          quality: 65,
        });
        console.log(`PASS ${device}: ${name}`);
      };
      const reload = async () => {
        await page.reload();
        await page
          .getByText("Loading isolated local QA fixture…")
          .waitFor({ state: "hidden" });
        await page.waitForTimeout(150);
      };
      await go("home");
      if (await button("Decline").count()) await button("Decline").click();
      assert.equal(
        await page
          .locator('[data-testid="shared-daily-plan"] .tier-primary-action')
          .innerText(),
        "DAILY CHECK-IN",
      );
      assert.equal(
        await page
          .locator('[data-testid="shared-daily-plan"] .tier-primary-action')
          .getAttribute("href"),
        "/dashboard/check-in",
      );
      assert.ok((await page.locator(".daily-essentials a").count()) > 0);
      await check("home");
      await page
        .getByText("How would you like to see your day?", { exact: true })
        .click();
      await page.getByLabel("Amount of guidance").selectOption("step");
      await button("Save display preferences").click();
      await reload();
      assert.equal(
        await page.locator(".daily-home").getAttribute("data-quiet"),
        "true",
      );
      assert.ok(await page.locator(".daily-essentials a").first().isVisible());
      await check("home-quiet");
      await go("check-in");
      await button("Save Daily Check-In").click();
      await page
        .getByText(
          "Choose your energy level first. The other questions are optional.",
        )
        .waitFor();
      const energy = page.getByRole("slider", { name: /^Energy/ });
      await energy.focus();
      await energy.press("ArrowRight");
      await button("Save Daily Check-In").click();
      await page
        .getByText(/Saved. Today’s workout and recovery guidance/)
        .waitFor();
      await reload();
      assert.equal(await energy.inputValue(), "6");
      await check("check-in-saved");
      await go("home");
      assert.notEqual(
        await page.locator('[data-testid="shared-daily-plan"] h2').innerText(),
        "Daily check-in",
      );
      await go("nutrition");
      await button("Suggested Foods").click();
      await page
        .locator('[data-testid="nutrition-suggested-foods-tab"]')
        .getByText("Plain Greek yogurt")
        .waitFor();
      await reload();
      await page
        .locator('[data-testid="nutrition-suggested-foods-tab"]')
        .waitFor();
      await check("food-suggestions");
      await button("Water").click();
      await page
        .locator("button")
        .filter({ hasText: /^Log water$/i })
        .click();
      await page.getByLabel("Amount (oz)").fill("8");
      await button("Log 8 oz").click();
      await page.getByText("8 oz saved. Today’s plan is updated.").waitFor();
      await page.getByLabel("Close water entry").click();
      await reload();
      assert.match(await page.locator("body").innerText(), /8 \/ 111 oz/);
      await check("hydration-saved");
      await button("Food Log").click();
      await page.getByLabel("Search food", { exact: true }).fill("yogurt");
      await button("Search Foods").click();
      await button("Plain Greek yogurt").click();
      await page.getByLabel("Serving amount", { exact: true }).fill("1");
      await button("Confirm meal and save").click();
      await page
        .getByText(/Meal saved|Saved to|saved.*today|added.*today/i)
        .first()
        .waitFor();
      await reload();
      assert.ok(
        (await page.locator("body").innerText()).includes("Plain Greek yogurt"),
      );
      await check("meal-saved");
      await go("workout");
      await page.getByRole("heading", { name: "Squat · 1 of 2" }).waitFor();
      const rows = page.locator(".activity-exercise");
      assert.equal(await rows.count(), 7);
      await rows
        .nth(0)
        .getByRole("button", { name: "Complete set 1", exact: true })
        .click();
      await page.waitForTimeout(150);
      const loaded = rows.nth(3);
      await loaded.getByLabel("Weight (lb, per hand)").fill("17.5");
      await loaded
        .getByRole("button", { name: "Complete set 1", exact: true })
        .click();
      await loaded.getByText("Recorded sets", { exact: true }).click();
      await loaded.getByText("Edit set 1", { exact: true }).click();
      await loaded.getByLabel(/Set 1 weight/).fill("18.5");
      await loaded.getByLabel("Set 1 reps").fill("9");
      await loaded
        .getByRole("button", { name: "Update set 1", exact: true })
        .click();
      await button("Save / pause").click();
      await reload();
      await page
        .locator(".activity-exercise")
        .nth(3)
        .getByText("Recorded sets", { exact: true })
        .click();
      assert.match(await page.locator("body").innerText(), /18.5/);
      assert.match(await page.locator("body").innerText(), /Squat · 1 of 2/);
      await check("workout-saved");
      await page.getByRole("tab", { name: "History", exact: true }).click();
      await reload();
      assert.equal(
        await page
          .getByRole("tab", { name: "History", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("tab", { name: "Progress", exact: true }).click();
      await button("Finish and review").click();
      await page
        .getByText(/partial/i)
        .first()
        .waitFor();
      await check("workout-partial");
      await page.getByRole("tab", { name: "Manual", exact: true }).click();
      const manual = page.locator('[data-testid="manual-workout-builder"]');
      await manual.getByRole("button", { name: /^Left quadriceps:/ }).click();
      await manual
        .getByRole("button", { name: "Dumbbell", exact: true })
        .click();
      await manual
        .locator('[data-testid="manual-movement-filter"] button')
        .first()
        .click();
      await manual
        .getByRole("button", { name: "Open", exact: true })
        .first()
        .click();
      const logger = manual.locator('[data-testid="manual-set-logger"]');
      assert.equal(
        await logger
          .getByRole("button", { name: "Finish Exercise", exact: true })
          .isDisabled(),
        true,
      );
      await logger.getByLabel(/^Weight/).fill("12.5");
      await logger.getByLabel("Reps", { exact: true }).fill("8");
      await logger
        .getByRole("button", { name: "Set Done", exact: true })
        .click();
      await logger.getByText("Set 1 saved.", { exact: true }).waitFor();
      await reload();
      assert.equal(
        await page
          .getByRole("tab", { name: "Manual", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await manual.getByLabel(/Set 1 weight/).fill("13.5");
      await manual
        .getByRole("button", { name: "Update set 1", exact: true })
        .click();
      await manual.getByText("Set updated.", { exact: true }).waitFor();
      await reload();
      assert.equal(
        await manual.getByLabel(/Set 1 weight/).inputValue(),
        "13.5",
      );
      await check("manual-workout-saved");
      await go("recovery");
      await page
        .locator('[data-testid="recovery-score-explanation"] summary')
        .click();
      await page.getByText(/Missing:.*Sleep duration/).waitFor();
      await button("Recovery Tools").click();
      assert.equal(await button("Complete Recovery Action").isDisabled(), true);
      await page.getByText(/Choose.*action.*enable/i).waitFor();
      await button("Gentle walk").click();
      await button("Complete Recovery Action").click();
      await page.getByText("Recovery saved for today.").waitFor();
      await reload();
      await button("History").click();
      assert.match(await page.locator("body").innerText(), /Gentle walk/);
      await check("recovery-saved");
      await go("schedule");
      const workLink = page.getByRole("link", {
        name: "Edit commitment",
        exact: true,
      });
      assert.equal(
        await workLink.getAttribute("href"),
        "/dashboard/assessment/daily-structure",
      );
      await page.getByRole("button", { name: /Accept .* suggestion/ }).click();
      await page.waitForTimeout(200);
      await reload();
      assert.equal(
        await page
          .getByRole("button", { name: /Accept .* suggestion/ })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Skip today", exact: true })
        .click();
      await reload();
      assert.match(await page.locator("body").innerText(), /Skipped/);
      await check("schedule-saved");
      await go("home");
      await page
        .getByText("Progress, assessments, and details", { exact: true })
        .click();
      await page.getByText("Detailed calendar", { exact: true }).click();
      await page.getByRole("tab", { name: "month", exact: true }).click();
      assert.equal(await page.locator(".tier-month-cell").count(), 42);
      const qaDate = await page
        .locator("[data-qa-date]")
        .getAttribute("data-qa-date");
      const [year, month] = qaDate.split("-").map(Number);
      const nextMonthFirst = new Date(Date.UTC(year, month, 1))
        .toISOString()
        .slice(0, 10);
      assert.equal(
        await page
          .locator(`.tier-month-cell[aria-label^="Open ${nextMonthFirst}"]`)
          .count(),
        1,
      );
      await reload();
      await page
        .getByText("Progress, assessments, and details", { exact: true })
        .click();
      await page.getByText("Detailed calendar", { exact: true }).click();
      assert.equal(
        await page
          .getByRole("tab", { name: "month", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("tab", { name: "day", exact: true }).click();
      await page.getByRole("tab", { name: "evening", exact: true }).click();
      const dismiss = button("Dismiss time");
      assert.ok((await dismiss.count()) > 0);
      await dismiss.first().click();
      const count = await dismiss.count();
      await reload();
      await page
        .getByText("Progress, assessments, and details", { exact: true })
        .click();
      await page.getByText("Detailed calendar", { exact: true }).click();
      assert.equal(await dismiss.count(), count);
      await button("Restore dismissed suggestions").click();
      assert.ok((await dismiss.count()) > count);
      await check("calendar-persistence");
      await go("nutrition", "ember");
      assert.equal(
        await page
          .getByRole("tab", { name: "Search / manual", exact: true })
          .count(),
        0,
      );
      assert.equal(await button("Add Food").count(), 0);
      await button("Suggested Foods").click();
      await page
        .locator('[data-testid="nutrition-suggested-foods-tab"]')
        .getByText("Plain Greek yogurt")
        .waitFor();
      await check("ember-entitlements");
      await go("nutrition", "phoenix");
      await button("Food Log").click();
      await page.getByRole("tab", { name: "Photo", exact: true }).waitFor();
      await check("phoenix-entitlements");
      if (device === "mobile") {
        await page.setViewportSize({ width: 320, height: 740 });
        await go("home");
        await check("home-320px");
      }
      assert.deepEqual(errors, [], `${device} browser errors`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
