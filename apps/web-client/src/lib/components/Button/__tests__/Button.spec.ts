/**
 * @vitest-environment jsdom
 */

import { describe, test, vi, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";

import TestComponent from "./TestComponent.svelte";

describe("Button", () => {
	describe("smoke test", () => {
		afterEach(() => {
			cleanup();
		});

		test("should propagate click event", () => {
			const mockClick = vi.fn();
			const { component } = render(TestComponent, { slot: "Button text" });
			component.$on("click", mockClick);
			screen.getByText("Button text").click();

			expect(mockClick).toHaveBeenCalled();
		});
	});
});
