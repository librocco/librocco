import type { Writable, Readable } from "svelte/store";
/**
 * Context for the current form field. Use {@link getFormField} to
 * retrieve the context in your component.
 *
 * @category Field
 * @category ElementField
 * @category Fieldset
 *
 * @typeParam T - The shape of the form object.
 * @typeParam U - The path to the field in the form object.
 *
 * @see {@link https://formsnap.dev/docs/functions/get-form-field getFormField Documentation}
 */
export type FieldContext = {
	/** A store containing the ID of the field errors container for the field. */
	fieldErrorsId: Writable<string>;

	/** A store containing the ID of the description element for the field. */
	descriptionId: Writable<string>;

	/** A store containing the name of the field. */
	name: Writable<string>;

	/** A store containing the current validations errors for the field. */
	errors: Writable<string[]>;

	/** A store containing the constraints (if any) for the field. */
	constraints: Writable<Record<string, unknown>>;

	/** A store containing the tainted state of the field. */
	tainted: Writable<boolean>;
};

/**
 * Context for a form control (label & input)
 */
export type FormControlContext = {
	/** A store containing the ID of the control element for the field. */
	id: Writable<string>;

	/** A store containing the attributes for the label element. */
	labelAttrs: Readable<LabelAttrs>;

	/** A store containing the attributes for the control element. */
	controlAttrs: Readable<ControlAttrs>;
};

export type ControlAttrs = {
	/** The name of the control used for form submission. */
	name: string;

	/** The ID of the control, used for label association. */
	id: string;

	/** Present when description or validation exists. */
	"aria-describedby": string | undefined;

	/** Present when a validation error exists on the field. */
	"aria-invalid": "true" | undefined;

	/** Present when the field is required. */
	"aria-required": "true" | undefined;
};

export type LabelAttrs = {
	/** The ID of the control, used for label association. */
	for: string;
	/** Any additional props provided to the `<Form.Label />` component */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
};

export type FieldErrorsAttrs = {
	/** The ID of the validation element, used to describe the control. */
	id: string;
};

export type DescriptionAttrs = {
	/** The ID of the description element, used to describe the control. */
	id: string;
};
