import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Delete?"
        message="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders as an alertdialog with labelled title + description when open", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete scenario?"
        message="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Delete scenario?");
    expect(document.getElementById(describedBy!)).toHaveTextContent("This cannot be undone.");
  });

  it("Escape invokes onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete?"
        message="Really?"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Confirm button invokes onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Delete?"
        message="Really?"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
