// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Dialog } from "../src/components/ui/dialog";
import { AddButton } from "../src/components/common";
import { entities } from "../src/lib/fixtures";
afterEach(cleanup);
describe("accessible shared controls", () => {
  it("names a dialog and supports keyboard dismissal", () => {
    const onChange = vi.fn();
    render(
      <Dialog open title="Private notes" onOpenChange={onChange}>
        <input aria-label="Note" />
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "Private notes" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onChange).toHaveBeenCalledWith(false);
  });
  it("makes duplicate adds unavailable and names the entity", () => {
    const add = vi.fn();
    render(<AddButton entity={entities[0]} added onClick={add} />);
    const button = screen.getByRole("button", {
      name: "Mosslight Presents is in your network",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(add).not.toHaveBeenCalled();
  });
});
