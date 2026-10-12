// Wait for the application's genuine widget. Never synthesize or reuse tokens.
// Visible mode allows an operator to complete a challenge if required.
export const hostedBrowserOptions = {
  headless: process.env.MUSICMAIL_ACCEPTANCE_HEADED !== "true",
};

export async function hostedChallenge(page) {
  if (!(await page.locator('[aria-label="Security verification"]').count()))
    return undefined;
  try {
    await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector('[name="cf-turnstile-response"]')?.value,
        ),
      null,
      { timeout: 60000 },
    );
    return await page.locator('[name="cf-turnstile-response"]').inputValue();
  } catch (error) {
    // Do not log Playwright's raw diagnostics: URLs can contain challenge data.
    throw new Error("Real CAPTCHA completion unavailable", {
      cause: page.isClosed()
        ? "captcha_page_closed"
        : error.name === "TimeoutError"
          ? "captcha_timeout"
          : "captcha_browser_fail",
    });
  }
}
