import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Explore, drawer and mobile have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.goto("/explore");
  await page
    .getByRole("button", { name: "Afterhours Journal", exact: true })
    .waitFor();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Afterhours Journal", exact: true })
    .click();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
});
