// @vitest-environment jsdom
import { useEffect } from "react";
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next/script", () => ({
  default: function Script({ onReady }: { onReady: () => void }) {
    useEffect(onReady, [onReady]);
    return null;
  },
}));
import { Captcha } from "../src/components/captcha";
let options: Record<string, unknown>;
const renderWidget = vi.fn(
  (_node: HTMLElement, value: Record<string, unknown>) => {
    options = value;
    return "widget-id";
  },
);
const remove = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "synthetic-public-key";
  window.turnstile = { render: renderWidget, remove };
});
afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete window.turnstile;
});
it("does not load a widget in unconfigured local development", () => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const view = render(<Captcha onToken={vi.fn()} />);
  expect(view.container.textContent).toBe("");
  expect(renderWidget).not.toHaveBeenCalled();
});
it("clears expired tokens and removes a widget when the form resets", () => {
  const onToken = vi.fn();
  const view = render(<Captcha onToken={onToken} />);
  act(() =>
    (options.callback as (token: string) => void)("synthetic-response"),
  );
  expect(onToken).toHaveBeenLastCalledWith("synthetic-response");
  act(() => (options["expired-callback"] as () => void)());
  expect(onToken).toHaveBeenLastCalledWith("");
  view.unmount();
  expect(remove).toHaveBeenCalledWith("widget-id");
});
it("reports verification failure without retaining a stale token", () => {
  const onToken = vi.fn();
  render(<Captcha onToken={onToken} />);
  act(() => (options["error-callback"] as () => void)());
  expect(screen.getByRole("alert").textContent).toContain("Reload this page");
  expect(onToken).toHaveBeenLastCalledWith("");
});
