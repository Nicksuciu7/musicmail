import { test, expect } from "@playwright/test";

test("progressive disclosure preserves discovery, follow-up and outreach", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Enter demo workspace" }).click();
  // The explicit local demo bypasses hosted authentication.
  await page.goto("/explore");
  await expect(
    page.getByLabel("Organisation", { exact: true }),
  ).not.toBeVisible();
  // Roles use the existing role filter; text search covers names/descriptions.
  await page.getByLabel("Search the music industry").fill("Mosslight");
  await page.getByLabel("Role", { exact: true }).selectOption("Promoter");
  await page.getByLabel("Location", { exact: true }).selectOption("London");
  await page.getByLabel("Genre", { exact: true }).selectOption("Folk");
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await expect(page.getByLabel("Organisation", { exact: true })).toBeVisible();
  await page.getByLabel("Email available", { exact: true }).check();
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Email available", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mosslight Presents", exact: true })
    .click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Source:", { exact: false })).not.toBeVisible();
  const details = drawer.locator("summary", { hasText: "More details" });
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(drawer.getByText("Source:", { exact: false })).toBeVisible();
  await page.keyboard.press("Enter");
  await drawer
    .getByRole("button", { name: "Add to My Network", exact: true })
    .click();
  await expect(
    drawer.getByRole("button", { name: "Email", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "My Network", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Genres", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email selected" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.getByLabel("Genres", { exact: true }).check();
  await expect(
    page.getByRole("columnheader", { name: "Genres", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mosslight Presents", exact: true })
    .click();
  await drawer
    .getByLabel("Private note", { exact: true })
    .fill("UX demo: send an acoustic session link.");
  await drawer.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    drawer.getByText("UX demo: send an acoustic session link.", {
      exact: true,
    }),
  ).toBeVisible();
  await drawer.getByLabel("Follow up on").fill("2026-10-15");
  await expect(drawer.getByLabel("Follow up on")).toHaveValue("2026-10-15");
  await drawer.locator("summary", { hasText: "Edit & organise" }).click();
  await drawer.getByLabel("Priority", { exact: true }).selectOption("high");
  await expect(drawer.getByLabel("Priority", { exact: true })).toHaveValue(
    "high",
  );
  await expect(drawer.getByLabel("Add to a list")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Follow-up for Mosslight Presents")).toHaveValue(
    "2026-10-15",
  );
  await page.getByLabel("Select Mosslight Presents", { exact: true }).check();
  await page.getByRole("button", { name: "Email selected" }).click();
  await page
    .getByLabel("Choose email template")
    .selectOption({ label: "A first introduction" });
  await page.getByRole("button", { name: "Preview message" }).click();
  await expect(
    page.getByText("Demo preview · sending disabled"),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Mail", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Templates" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Mail navigation" })
    .getByRole("link", { name: "Templates" })
    .click();
  await expect(
    page.getByRole("button", { name: "New template" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit template" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
