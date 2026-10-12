import { test, expect } from "@playwright/test";

test("Gmail failure survives workspace loading and refresh; query cannot fake connection", async ({
  page,
}) => {
  await page.goto("/settings?gmail=failed");
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  const failure = page.getByRole("alert").filter({
    hasText: "Gmail connection failed.",
  });
  await expect(failure).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Feedback test");
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspace") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "Save account details" }).click();
  await refreshed;
  await expect(failure).toBeVisible();

  await page.goto("/settings?gmail=connected");
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await expect(failure).toHaveCount(0);
  await expect(page.getByText(/^Connected as /)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Disconnect Gmail" }),
  ).toHaveCount(0);
});
