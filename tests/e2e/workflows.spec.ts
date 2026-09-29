import { test, expect } from "@playwright/test";
test("artist → discover → private relationship → template preview", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByRole("link", { name: "Enter demo workspace" }).click();
  await page.getByLabel("Artist / project name").fill("Quiet Hours");
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page.getByLabel("Where are you based?").fill("London");
  await page.getByRole("button", { name: "Indie Folk", exact: true }).click();
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page.getByRole("button", { name: "Intimate", exact: true }).click();
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page
    .getByRole("button", { name: "Find promoters", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page.getByRole("button", { name: "Continue without import" }).click();
  await page.getByRole("button", { name: "Find my people" }).click();
  await expect(
    page.getByRole("button", { name: "Mosslight Presents", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("3 connections", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Mosslight Presents", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to My Network", exact: true })
    .click();
  await page
    .getByLabel("Private note", { exact: true })
    .fill("Met after the show. Send our new EP.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Met after the show. Send our new EP.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Relationship", { exact: true }).selectOption("warm");
  await page.getByRole("button", { name: "Email", exact: true }).click();
  await page
    .getByLabel("Choose email template")
    .selectOption({ label: "A first introduction" });
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(
    "Quiet Hours — a little introduction",
  );
  await page.getByRole("button", { name: "Preview message" }).click();
  await expect(
    page.getByText("Demo preview · sending disabled"),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/network");
  await expect(
    page.getByLabel("Relationship for Mosslight Presents"),
  ).toHaveValue("warm");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mosslight Presents", exact: true }),
  ).toBeVisible();
});
test("CSV mapping, lists, saved views and export", async ({ page }) => {
  await page.goto("/network");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "contacts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Name,Email,Company,Notes\nDemo Booker,booker@example.test,Demo Music,Met at a showcase",
    ),
  });
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("button", { name: "Import 1 contacts" }).click();
  await expect(
    page.getByRole("button", { name: "Demo Booker", exact: true }),
  ).toBeVisible();
  await page.goto("/lists");
  await page.getByLabel("New list name").fill("EP launch");
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page.getByRole("heading", { name: "EP launch" })).toBeVisible();
  await page.goto("/network");
  await page.getByLabel("Select Demo Booker", { exact: true }).check();
  await page
    .getByLabel("Add selected to list")
    .selectOption({ label: "EP launch" });
  await page.getByText("Views", { exact: true }).click();
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByLabel("View name").fill("People to meet");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save view" })
    .click();
  await page.getByText("Views", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "People to meet" }),
  ).toBeVisible();
  await page.getByLabel("Search the music industry").fill("No matching name");
  await page
    .getByRole("button", { name: "People to meet", exact: true })
    .click();
  await expect(page).toHaveURL(/\/network\?/);
  await expect(
    page.getByRole("button", { name: "Demo Booker", exact: true }),
  ).toBeVisible();
  const response = await page.request.get("/api/export");
  expect(await response.text()).toContain("Met at a showcase");
});
test("sessions are isolated, CSRF is rejected, mobile fits", async ({
  browser,
  page,
}) => {
  await page.goto("/network");
  await page.getByRole("button", { name: "Add contact", exact: true }).click();
  await page
    .getByLabel("Name *", { exact: true })
    .fill("Private Session Contact");
  await page.getByRole("button", { name: "Add private contact" }).click();
  await expect(
    page.getByRole("button", { name: "Private Session Contact", exact: true }),
  ).toBeVisible();
  const other = await browser.newContext();
  const p = await other.newPage();
  await p.goto("http://localhost:3000/network");
  await expect(
    p.getByText("Your network starts with one contact."),
  ).toBeVisible();
  await other.close();
  const denied = await page.request.post("/api/workspace", {
    data: { action: "list", name: "CSRF" },
  });
  expect(denied.status()).toBe(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await expect(
    page.getByRole("button", { name: "Afterhours Journal", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "My Network", exact: true }),
  ).toBeVisible();
});

test("older contacts load on demand and complete export remains available", async ({
  page,
}) => {
  await page.goto("/network");
  await page
    .getByRole("button", { name: "Add contact", exact: true })
    .waitFor();
  const contacts = Array.from({ length: 120 }, (_, i) => ({
    name: `Volume Contact ${String(i).padStart(3, "0")}`,
    email: `volume${i}@example.test`,
    notes: `Private context ${i}`,
  }));
  const imported = await page.request.post("/api/workspace", {
    headers: { Origin: "http://localhost:3000" },
    data: { action: "import", contacts, confirmDuplicates: false },
  });
  expect(imported.ok()).toBe(true);
  const summary = await imported.json();
  expect(summary.contacts.length).toBeLessThanOrEqual(50);
  expect(summary.notes).toHaveLength(0);
  await page.reload();
  await page.getByLabel("Search the music industry").fill("Volume Contact 000");
  await page
    .getByRole("button", { name: "Volume Contact 000", exact: true })
    .click();
  await expect(
    page.getByText("Private context 0", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Private note", { exact: true })
    .fill("An on-demand note");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("An on-demand note", { exact: true }),
  ).toBeVisible();
  const preview = await page.request.post("/api/import/preview", {
    headers: { Origin: "http://localhost:3000" },
    data: { contacts: [contacts[0]] },
  });
  expect((await preview.json()).duplicates).toEqual([0]);
  const exported = await (
    await page.request.get("/api/export?format=json")
  ).json();
  expect(exported.contacts).toHaveLength(120);
  expect(exported.notes).toHaveLength(121);
});
