import { test, expect } from "@playwright/test";
test("demo clients cannot open the admin page or call admin endpoints", async ({
  page,
}) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "MusicMail administration." }),
  ).toHaveCount(0);
  for (const path of [
    "/api/admin/support?view=users",
    "/api/admin/support?view=audit",
    "/api/admin/entity?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "/api/admin/records?table=genres",
  ])
    expect((await page.request.get(path)).status()).toBe(403);
  for (const path of ["/api/admin", "/api/admin/roles", "/api/admin/records"])
    expect(
      (
        await page.request.post(path, {
          headers: { Origin: "http://localhost:3000" },
          data: {},
        })
      ).status(),
    ).toBe(403);
});
