/**
 * @jest-environment jsdom
 */

// ^^^ Since the test environment isn't specified in 'jest.config.js', we need to set it per testfile bases like above

import React from "react";
import { render } from "@testing-library/react";

import { SVGTest } from "ui";

describe("This is an example for testing of the UI components, requireing the DOM environment", () => {
  test("should render without breaking", () => {
    render(<SVGTest />);
  });
});
