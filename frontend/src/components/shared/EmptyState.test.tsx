import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and body", () => {
    render(<EmptyState title="Nothing here" body="Add something to get started." />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add something to get started.")).toBeInTheDocument();
  });

  it("renders optional actions slot", () => {
    render(
      <EmptyState
        title="Nothing here"
        body="Add something."
        actions={<button type="button">Create</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <EmptyState title="Nothing here" body="Add something." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
