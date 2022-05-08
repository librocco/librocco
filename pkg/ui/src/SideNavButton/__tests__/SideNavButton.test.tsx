import React from "react";
import { screen, render, cleanup } from "@testing-library/react";

import SideNavButton from "../SideNavButton";

beforeEach(() => {
  jest.clearAllMocks();
  cleanup();
});

describe("SideNavButton", () => {
  test("should lift 'onClick' functionality", () => {
    const mockOnClick = jest.fn();
    render(<SideNavButton onClick={mockOnClick} />);
    screen.getByRole("button").click();
    expect(mockOnClick).toHaveBeenCalled();
  });

  test("should render the component with html tags provided as 'as' prop (if no custom 'component' provided)", () => {
    render(<SideNavButton />);
    // The default should be <button>
    screen.getByRole("button");
    expect(screen.queryByRole("nav")).toBeFalsy();
    // Now the <nav> should be rendered instead of button
    cleanup();
    render(<SideNavButton as="nav" />);
    screen.getByRole("navigation");
    expect(screen.queryByRole("button")).toBeFalsy();
  });
});
