import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
] as const;

describe("Segmented", () => {
  it("renders all options and reflects the active one via aria-selected", () => {
    render(
      <Segmented options={[...options]} value="b" onChange={() => {}} ariaLabel="Greek" />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");
  });

  it("applies roving tabindex — only the active option is tabbable", () => {
    render(<Segmented options={[...options]} value="a" onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[2]).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRight moves selection and focus to the next option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={[...options]} value="a" onChange={onChange} />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ArrowLeft wraps from first to last", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={[...options]} value="a" onChange={onChange} />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("Home / End jump to first / last", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={[...options]} value="b" onChange={onChange} />);
    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("a");
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("c");
  });

  it("click still activates an option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={[...options]} value="a" onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
