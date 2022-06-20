import React from "react";
import { render, screen } from "@testing-library/react";

import NoteButton, { Warehouse } from "../NoteButton";

describe("Smoke test", () => {
  test("should fire 'onClick' method", () => {
    const mockOnClick = jest.fn();
    render(<NoteButton onClick={mockOnClick} label={Warehouse.Varia} />);
    screen.getByText(Warehouse.Varia).click();
    expect(mockOnClick).toHaveBeenCalled();
  });
});
