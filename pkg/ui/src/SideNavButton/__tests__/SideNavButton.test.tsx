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

  test("should render the SideNavButton as the custom 'component' if such provided and pass the props to a given component", () => {
    const testProps = {
      foo: "bar",
      fizz: ["buzz"],
    };
    const MockCustomComponent = jest.fn();
    render(<SideNavButton component={MockCustomComponent} {...testProps} />);
    expect(MockCustomComponent).toHaveBeenCalledTimes(1);
    // Get props passed to the first (and only) call to the 'MockCustomComponent'
    const [callProps] = MockCustomComponent.mock.calls[0];
    // The 'children' and 'className' are provided inside the 'SideNavButton'
    // We want to get the rest of the props to test against the props passed to the component
    const { children, className, ...passedProps } = callProps;
    expect(passedProps).toEqual(testProps);
  });

  test("should render the SideNavButton as the custom 'component' if such provided and pass the props to a given component", () => {
    const testProps = {
      foo: "bar",
      fizz: ["buzz"],
    };
    const MockCustomComponent = jest.fn();
    render(<SideNavButton component={MockCustomComponent} {...testProps} />);
    expect(MockCustomComponent).toHaveBeenCalledTimes(1);
    // Get props passed to the first (and only) call to the 'MockCustomComponent'
    const [callProps] = MockCustomComponent.mock.calls[0];
    // The 'children' and 'className' are provided inside the 'SideNavButton'
    // We want to get the rest of the props to test against the props passed to the component
    const { children, className, ...passedProps } = callProps;
    expect(passedProps).toEqual(testProps);
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
