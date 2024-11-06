import { getContext, hasContext, setContext } from "svelte";
import type { FormControlContext, FieldContext } from "./types";

const FORM_FIELD = Symbol("FORM_FIELD_CTX");
const FORM_CONTROL = Symbol("FORM_CONTROL_CTX");

/**
 * @private
 */
export function setFormFieldCtx(props: FieldContext) {
	setContext(FORM_FIELD, props);
	return props;
}

/**
 * Gets context for the closest form field in the component tree.
 * Use this function for more advanced component composition.
 *
 * @category Field
 * @category ElementField
 * @category Fieldset
 * @see {@link https://formsnap.dev/docs/functions/get-form-field getFormField Documentation}
 */
export function getFormFieldCtx(): FieldContext {
	if (!hasContext(FORM_FIELD)) {
		ctxError("Form.Field");
	}
	return getContext(FORM_FIELD);
}

/**
 * @private
 */
export function setFormControlCtx(props: FormControlContext) {
	setContext(FORM_CONTROL, props);
	return props;
}

/**
 * Gets context for the closest form item in the component tree.
 */
export function getFormControlCtx(): FormControlContext {
	if (!hasContext(FORM_CONTROL)) {
		ctxError("<FormFieldProxy />");
	}
	return getContext(FORM_CONTROL);
}

function ctxError(ctx: string) {
	throw new Error(
		`Unable to find \`${ctx}\` context. Did you forget to wrap the component in a \`${ctx}\`?`,
	);
}
