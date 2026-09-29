import { chromium } from "@playwright/test";
const origin = "http://localhost:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/explore");
  await page
    .getByRole("button", { name: "Afterhours Journal", exact: true })
    .waitFor();
  const initial = await (
    await context.request.get(origin + "/api/workspace")
  ).json();
  if (!initial.demo)
    throw new Error("Screenshots require the synthetic demo environment.");
  const action = async (input) => {
    const r = await context.request.post(origin + "/api/workspace", {
      headers: { Origin: origin },
      data: input,
    });
    if (!r.ok()) throw new Error(await r.text());
    return r.json();
  };
  await action({
    action: "onboard",
    name: "Quiet Hours",
    type: "duo",
    location: "London",
    genres: ["Indie Folk"],
    emotions: ["Intimate", "Warm"],
    goals: ["Book gigs", "Find promoters"],
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Afterhours Journal", exact: true })
    .waitFor();
  await page.screenshot({ path: "docs/screenshots/explore-desktop.png" });
  for (const i of [1, 2, 3, 7, 10, 13])
    await action({
      action: "add",
      entityId: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    });
  const w = await (await context.request.get(origin + "/api/workspace")).json();
  const contact = w.contacts.find(
    (c) => c.entity_id === "10000000-0000-4000-8000-000000000001",
  );
  await action({
    action: "update",
    id: contact.id,
    patch: {
      relationship_status: "warm",
      outreach_status: "replied",
      priority: "high",
      follow_up_at: "2026-10-02",
      relationship_origin: "Demo introduction after a listening-room show.",
    },
  });
  await action({
    action: "note",
    id: contact.id,
    body: "Demo note: interested in hearing the acoustic EP. Share one private listening link and ask about an autumn support slot.",
  });
  await action({ action: "list", name: "Autumn shows" });
  await page.goto(origin + "/network");
  await page
    .getByRole("button", { name: "Mosslight Presents", exact: true })
    .waitFor();
  await page.screenshot({ path: "docs/screenshots/network-desktop.png" });
  await page
    .getByRole("button", { name: "Mosslight Presents", exact: true })
    .click();
  await page.getByLabel("Private note", { exact: true }).waitFor();
  await page
    .locator(".network-table .entity-name")
    .filter({ hasText: "Mosslight Presents" })
    .waitFor({ state: "visible" });
  await page.screenshot({ path: "docs/screenshots/contact-drawer.png" });
  await page.getByRole("button", { name: "Email", exact: true }).click();
  await page
    .getByLabel("Choose email template")
    .selectOption({ label: "A first introduction" });
  await page.screenshot({ path: "docs/screenshots/email-composer.png" });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/explore");
  await page
    .getByRole("button", { name: "Afterhours Journal", exact: true })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/explore-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  for (const route of [
    "home",
    "lists",
    "mail",
    "templates",
    "settings",
    "onboarding",
  ]) {
    await page.goto(origin + "/" + route);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.screenshot({
      path: `docs/screenshots/${route}-desktop.png`,
      fullPage: true,
    });
  }
  await page.goto(origin + "/network");
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "demo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Name,Email,Notes\nDemo Booker,booker@example.test,Demo introduction",
    ),
  });
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("button", { name: "Import 1 contacts" }).waitFor();
  await page.screenshot({ path: "docs/screenshots/csv-import.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Twelve synthetic product screenshots saved; no browser runtime errors.",
  );
} finally {
  await browser.close();
}
