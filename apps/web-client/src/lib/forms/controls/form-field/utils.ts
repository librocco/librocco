import type { ValidationErrors } from "sveltekit-superforms";

// Copied from https://github.com/svecosystem/formsnap > internal/utils

/**
 * Retrieves the appropriate `aria-describedby` value for a form control
 * given the existence of a description and/or validation message.
 */
export function getAriaDescribedBy({
	fieldErrorsId = undefined,
	descriptionId = undefined,
	errors
}: {
	fieldErrorsId: string | undefined;
	descriptionId: string | undefined;
	errors: string[];
}) {
	let describedBy = "";

	if (descriptionId) {
		describedBy += descriptionId + " ";
	}
	if (errors.length && fieldErrorsId) {
		describedBy += fieldErrorsId;
	}
	return describedBy ? describedBy.trim() : undefined;
}

/**
 * Retrieves the appropriate `aria-required` attribute value for a form
 * control given the constraints for the field.
 */
export function getAriaRequired(constraints: Record<string, unknown>) {
	if (!("required" in constraints)) return undefined;
	return constraints.required ? ("true" as const) : undefined;
}

/**
 * Retrieves the appropriate `aria-invalid` attribute value for a form
 * control given the current validation errors.
 */
export function getAriaInvalid(errors: string[] | undefined) {
	return errors && errors.length ? ("true" as const) : undefined;
}

export function getValueAtPath(path: string, obj: Record<string, unknown>) {
	const keys = path.split(/[[\].]/).filter(Boolean);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value = obj as any;

	for (const key of keys) {
		if (typeof value !== "object" || value === null) {
			return undefined; // Handle cases where the path doesn't exist in the object
		}
		value = value[key];
	}

	return value;
}

/**
 * Extracts the error array from a `ValidationErrors` object.
 */
export function extractErrorArray<T extends Record<string, unknown>>(errors: ValidationErrors<T> | undefined): string[] {
	if (Array.isArray(errors)) return errors;
	if (typeof errors === "object" && "_errors" in errors) {
		if (errors._errors !== undefined) return errors._errors;
	}

	return [];
}
