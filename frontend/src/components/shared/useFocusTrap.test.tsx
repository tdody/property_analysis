import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFocusTrap } from "./useFocusTrap";

function Harness({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div ref={ref} data-testid="trap">
      <button type="button">first</button>
      <button type="button">middle</button>
      <button type="button">last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("auto-focuses the first focusable child when active", () => {
    render(<Harness active={true} />);
    expect(document.activeElement?.textContent).toBe("first");
  });

  it("does not auto-focus when inactive", () => {
    render(<Harness active={false} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("Shift+Tab on the first element wraps to the last", () => {
    const { getByTestId, getByText } = render(<Harness active={true} />);
    const first = getByText("first");
    const last = getByText("last");
    first.focus();
    fireEvent.keyDown(getByTestId("trap"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("Tab on the last element wraps to the first", () => {
    const { getByTestId, getByText } = render(<Harness active={true} />);
    const first = getByText("first");
    const last = getByText("last");
    last.focus();
    fireEvent.keyDown(getByTestId("trap"), { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });
});
