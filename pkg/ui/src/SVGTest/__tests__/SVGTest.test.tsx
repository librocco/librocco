import { render } from "@testing-library/react";
import React from "react";

import SVGTest from "../SVGTest";

describe("Test SVG mocking for jest", () => {
  test("shouldn't break", () => {
    render(<SVGTest />);
  });
});
