import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton, SkeletonLine } from "./Skeleton";

describe("Skeleton", () => {
  it("renders with aria-hidden and skeleton class", () => {
    const { container } = render(<Skeleton className="h-10" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveClass("skeleton", "h-10");
  });

  it("SkeletonLine sets a default 14px height", () => {
    const { container } = render(<SkeletonLine className="w-20" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("skeleton", "h-[14px]", "w-20");
    expect(el).toHaveAttribute("aria-hidden", "true");
  });
});
