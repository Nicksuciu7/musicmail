import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Temporal } from "@js-temporal/polyfill";
const origin = "http://localhost:3000";
const date = Temporal.Now.zonedDateTimeISO("Europe/London")
  .toPlainDate()
  .add({ days: 2 })
  .toString();
async function axe(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
}
async function addGig(page: Page, title: string) {
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Add event", exact: true })
    .first()
    .click();
  await page.getByLabel("Title *", { exact: true }).fill(title);
  await page.getByLabel("Date *", { exact: true }).fill(date);
  await page.getByLabel("Start time", { exact: true }).fill("19:30");
  await page.getByLabel("End time", { exact: true }).fill("22:00");
  await page
    .getByLabel("Location / venue", { exact: true })
    .fill("Fictional Windmill");
  await page.getByLabel("Item", { exact: true }).fill("Martin D-28");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item", { exact: true }).fill("mics");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-describedby",
    /.+/,
  );
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}
for (const mobile of [false, true])
  test(`${mobile ? "mobile" : "desktop"} musician calendar flow, checklist, edit and export`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await addGig(page, "Calendar acceptance gig");
    await expect(
      page.getByRole("checkbox", { name: "Martin D-28", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "2 × mics", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: "Martin D-28", exact: true })
      .check();
    await expect(
      page.getByRole("checkbox", { name: "Martin D-28", exact: true }),
    ).toBeChecked();
    await axe(page);
    await page.getByRole("button", { name: "Edit event", exact: true }).click();
    await page
      .getByLabel("Title *", { exact: true })
      .fill("Edited calendar gig");
    await page
      .getByLabel("Notes", { exact: true })
      .fill("Bring spare strings.");
    await page.getByText("Gig details", { exact: true }).click();
    await page.getByLabel("Load-in time", { exact: true }).fill("17:30");
    await page.getByRole("button", { name: "Save event", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Edited calendar gig", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Martin D-28", exact: true }),
    ).toBeChecked();
    await expect(page.getByText("17:30", { exact: true })).toBeVisible();
    await page.getByText("Add to external calendar", { exact: true }).click();
    const link = page.getByRole("link", {
      name: "Google Calendar ↗",
      exact: true,
    });
    expect(
      new URL((await link.getAttribute("href"))!).searchParams.get("text"),
    ).toBe("Edited calendar gig");
    const download = page.getByRole("link", {
      name: "Apple / Outlook (.ics)",
      exact: true,
    });
    const result = await page.request.get(
      (await download.getAttribute("href"))!,
    );
    expect(result.headers()["content-type"]).toContain("text/calendar");
    expect(await result.text()).toContain("SUMMARY:Edited calendar gig");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Edited calendar gig.*packed/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await page
      .getByRole("button", { name: /Edited calendar gig.*packed/ })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Martin D-28", exact: true }),
    ).toBeChecked();
    const exported = await (
      await page.request.get("/api/export?format=json")
    ).json();
    expect(
      exported.calendarEvents.find(
        (e: { title: string }) => e.title === "Edited calendar gig",
      ).items,
    ).toHaveLength(2);
    await page
      .getByRole("button", { name: "Delete event", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Edited calendar gig.*packed/ }),
    ).toHaveCount(0);
  });
test("calendar sessions isolate all API actions and ICS", async ({
  page,
  browser,
}) => {
  await addGig(page, "Private Calendar A");
  const exported = await (
    await page.request.get("/api/export?format=json")
  ).json();
  const a = exported.calendarEvents.find(
    (e: { title: string }) => e.title === "Private Calendar A",
  );
  const other = await browser.newContext();
  const p = await other.newPage();
  await p.goto(origin + "/calendar");
  await expect(
    p.getByRole("button", { name: /Private Calendar A/ }),
  ).toHaveCount(0);
  for (const data of [
    { action: "delete", id: a.id },
    { action: "check", id: a.id, itemId: a.items[0].id, completed: true },
    { action: "save", id: a.id, event: { title: "Stolen", date } },
  ])
    expect(
      (
        await p.request.post(origin + "/api/calendar", {
          headers: { Origin: origin },
          data,
        })
      ).status(),
    ).toBe(404);
  expect(
    (await p.request.get(origin + `/api/calendar/${a.id}/export`)).status(),
  ).toBe(404);
  const csrf = await page.request.post("/api/calendar", {
    data: { action: "delete", id: a.id },
  });
  expect(csrf.status()).toBe(400);
  await other.close();
});
test("quick all-day creation, month, Home and account reset", async ({
  page,
}) => {
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Add event", exact: true })
    .first()
    .click();
  await page.getByLabel("Title *", { exact: true }).fill("Date only gig");
  await page.getByLabel("Date *", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Date only gig", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("All day");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Date only gig on ${date}`, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await axe(page);
  await page.goto("/home");
  await expect(page.getByRole("link", { name: /Date only gig/ })).toBeVisible();
  const response = await page.request.delete("/api/account", {
    headers: { Origin: origin },
    data: { confirmation: "DELETE" },
  });
  expect(response.ok()).toBe(true);
  expect(
    (
      await (await page.request.get("/api/export?format=json")).json()
    ).calendarEvents.some(
      (e: { title: string }) => e.title === "Date only gig",
    ),
  ).toBe(false);
});
for (const theme of ["light", "dark"] as const)
  test(`${theme} appearance persists without hydration errors; major screens meet WCAG`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /hydration|did not match/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto("/settings");
    await page
      .getByRole("radio", {
        name: theme === "light" ? "Light" : "Dark",
        exact: true,
      })
      .check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("radio", {
        name: theme === "light" ? "Light" : "Dark",
        exact: true,
      }),
    ).toBeEnabled();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("radio", {
        name: theme === "light" ? "Light" : "Dark",
        exact: true,
      }),
    ).toBeChecked();
    const contact = await page.request.post("/api/workspace", {
      headers: { Origin: origin },
      data: {
        action: "private",
        contact: { name: "Theme test recipient", email: "theme@example.test" },
      },
    });
    expect(contact.ok()).toBe(true);
    for (const path of [
      "/home",
      "/explore",
      "/network",
      "/calendar",
      "/lists",
      "/mail",
      "/templates",
      "/settings",
      "/login",
      "/signup",
      "/forgot-password",
      "/verify-email",
      "/reset-password",
      "/change-password",
      "/onboarding",
    ]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      if (!["/login", "/signup", "/forgot-password"].includes(path))
        await page.getByRole("heading", { level: 1 }).waitFor();
      await expect(
        page.getByText("Loading your workspace…", { exact: true }),
      ).toHaveCount(0);
      await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
      await expect(
        page.getByText("Loading events…", { exact: true }),
      ).toHaveCount(0);
      await axe(page);
      const response = await page.request.get(path);
      expect(await response.text()).toContain(`data-theme="${theme}"`);
    }
    await page.goto("/calendar");
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(
      page.getByText("Loading events…", { exact: true }),
    ).toHaveCount(0);
    await axe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await axe(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Add event", exact: true })
      .first()
      .click();
    await axe(page);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/explore");
    await page
      .getByRole("button", { name: "Afterhours Journal", exact: true })
      .click();
    await axe(page);
    await page.keyboard.press("Escape");
    await page.goto("/mail");
    await page
      .getByRole("button", { name: /Compose|Write a message/ })
      .first()
      .click();
    await axe(page);
    await page
      .getByRole("checkbox", { name: "Theme test recipient", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Continue with 1 contacts", exact: true })
      .click();
    await expect(page.getByLabel("Subject", { exact: true })).toBeVisible();
    await axe(page);
    await page.getByLabel("Subject", { exact: true }).fill("A theme preview");
    await page
      .getByLabel("Your message", { exact: true })
      .fill("Hi, here is a fictional message preview.");
    await page
      .getByRole("button", { name: "Preview message", exact: true })
      .click();
    await axe(page);
    expect(errors).toEqual([]);
  });
test("System follows device immediately; manual mode overrides it", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect(
    page.getByRole("radio", { name: "System", exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("light");
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("dark");
  await page.getByRole("radio", { name: "System", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect(
    page.getByRole("radio", { name: "System", exact: true }),
  ).toBeEnabled();
  await page.reload();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("light");
});
