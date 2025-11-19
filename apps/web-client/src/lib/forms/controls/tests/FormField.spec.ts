import { render, cleanup } from "@testing-library/svelte";
import { it, describe, expect, afterEach } from "vitest";
import { page } from "@vitest/browser/context";

import { defaults, superValidate, type FormOptions, type Infer } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { z } from "zod";

import FormFieldHarness from "./FormFieldHarness.svelte";

// NOTE: this is a duplicate from schema definition in the FieldFormHarness.svelte
// but some TS version might produce false-positives when importing from .svelte file module script blocks
const testSchema = z.object({
	name: z.string().max(2)
});

afterEach(() => {
	cleanup();
});

const options: FormOptions<Infer<typeof testSchema>> = {
	SPA: true,
	validators: zod(testSchema),
	validationMethod: "submit-only"
};

describe("The FormFieldProxy controller and Text|CheckControl combo should", () => {
	it("define essential/a11y attributes to the label, control and description of a form field", async () => {
		const defaultForm = defaults(zod(testSchema));

		const { container } = render(FormFieldHarness, { form: defaultForm, options });

		const name = "Name";
		const descText = "Description";

		// Use Playwright-style locators
		const label = page.elementLocator(container).getByText(name);
		const control = page.elementLocator(container).getByRole("textbox", { name });
		const description = page.elementLocator(container).getByText(descText);

		// Use browser matchers with expect.element()
		await expect.element(control).toBeInTheDocument();
		await expect.element(label).toBeInTheDocument();
		await expect.element(description).toBeInTheDocument();

		// The label should be associated with the control via "for"-"id" attributes
		await expect.element(control).toHaveAttribute("id", label.element().getAttribute("for"));

		// Check aria-describedby matches description id
		await expect.element(control).toHaveAttribute("aria-describedby", description.element().getAttribute("id")!);

		// The control is required and constraints are spread on it
		await expect.element(control).toHaveAttribute("aria-required", "true");
		await expect.element(control).toHaveAttribute("maxlength", "2");

		// The control is not invalid in this state
		await expect.element(control).not.toHaveAttribute("aria-invalid");
	});

	it("update a11y attributes on the control when its invalid", async () => {
		const errForm = await superValidate({ name: "tooo long" }, zod(testSchema));

		const { container } = render(FormFieldHarness, { form: errForm, options });

		const name = "Name";

		const control = page.elementLocator(container).getByRole("textbox", { name });

		await expect.element(control).toBeInTheDocument();

		// In the harness there are two spans, the first is the description,
		// the second is conditionally shown if there is an error
		// Query all spans within the container
		const spans = container.querySelectorAll("span");
		const errSpan = spans[1];

		// describedby will include "<the description id> <the error description id>"
		const describedBy = control.element().getAttribute("aria-describedby");
		const [, errDescribedById] = describedBy!.split(" ");

		// => we expect this second id to be the same as the error span
		expect(errDescribedById).toEqual(errSpan.getAttribute("id"));

		// The control is invalid in this state
		await expect.element(control).toHaveAttribute("aria-invalid", "true");
	});
});
