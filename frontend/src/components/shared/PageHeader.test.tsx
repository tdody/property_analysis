import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "jest-axe";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders the title as an h1 with the .h1 class by default", () => {
    render(<PageHeader title="Settings" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Settings");
    expect(heading).toHaveClass("h1");
  });

  it("uses the .hero class when hero=true", () => {
    render(<PageHeader title="Welcome" hero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("hero");
  });

  it("renders optional eyebrow and subtitle", () => {
    render(
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Defaults and appearance."
      />,
    );
    expect(screen.getByText("Workspace")).toHaveClass("caps-eyebrow");
    expect(screen.getByText("Defaults and appearance.")).toBeInTheDocument();
  });

  it("renders actions slot", () => {
    render(
      <PageHeader
        title="Compare"
        actions={<button type="button">Export</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Defaults and appearance."
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
