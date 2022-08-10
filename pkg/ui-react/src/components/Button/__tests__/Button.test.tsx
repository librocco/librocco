import React from "react";
import { render, screen } from "@testing-library/react";

import Button from "../Button";

describe("An example unit test", () => {
  test("should fire 'onClick' method", () => {
    const mockOnClick = jest.fn();
    render(<Button onClick={mockOnClick}>Button Text</Button>);
    screen.getByText("Button Text").click();
    expect(mockOnClick).toHaveBeenCalled();
  });

  test("if no input for 'as' provided, should fall back to button", () => {
    render(<Button>Button Text</Button>);
    screen.getByRole("button");
  });
});
