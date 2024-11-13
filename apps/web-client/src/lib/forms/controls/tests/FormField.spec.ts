import { render, screen, cleanup } from "@testing-library/svelte";
import { it, describe, expect, afterEach } from "vitest";
// TODO: this should be done globally but its not working for some reason :(
import "@testing-library/jest-dom";

import { defaults, superValidate, type FormOptions, type Infer } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";

import { default as FormFieldHarness, testSchema } from "./FormFieldHarness.svelte";

afterEach(() => {
	cleanup();
});

const options: FormOptions<Infer<typeof testSchema>> = {
	SPA: true,
	validators: zod(testSchema),
	validationMethod: "submit-only"
};

describe("The FormFieldProxy controller and Text|CheckControl combo should", () => {
	it("define essential/a11y attributes to the label, control and description of a form field", () => {
		const defaultForm = defaults(zod(testSchema));

		render(FormFieldHarness, { form: defaultForm, options });

		const name = "Name";
		const descText = "Description";

		const label = screen.getByText(name);
		const control = screen.getByRole("textbox", { name });
		const description = screen.getByText(descText);

		// The label should be associated with the control via "for"-"id" attributes
		expect(control.getAttribute("id")).toEqual(label.getAttribute("for"));
		expect(control.getAttribute("aria-describedby")).toEqual(description.getAttribute("id"));

		// The control is required and constraints are spread on it
		expect(control).toHaveAttribute("aria-required", "true");
		expect(control).toHaveAttribute("maxLength", "2");

		// The control is not invlaid in this state
		expect(control).not.toHaveAttribute("aria-invalid");
	});

	it("update a11y attributes on the control when its invalid", async () => {
		const errForm = await superValidate({ name: "tooo long" }, zod(testSchema));

		render(FormFieldHarness, { form: errForm, options });

		const name = "Name";

		const control = screen.getByRole("textbox", { name });

		// In the harness there are two spans, the first is the description,
		// the second is conditionally shown if there is an error
		const [, errSpan] = document.querySelectorAll("span");

		// decribedby will include "<the description id> <the error desscription id>"
		const [, errDescribedById] = control.getAttribute("aria-describedby").split(" ");
		// => we expect this second id to the same as the error span
		expect(errDescribedById).toEqual(errSpan.getAttribute("id"));

		// The control is invalid in this state
		expect(control).toHaveAttribute("aria-invalid", "true");
	});
});
