import { nanoid } from "nanoid";
import { derived } from "svelte/store";

import { getAriaDescribedBy, getAriaInvalid, getAriaRequired } from "./utils";

import type { FieldContext, LabelAttrs } from "./types";

export function createFormField(fieldCtx: FieldContext) {
	return {
		description: createDescription(fieldCtx),
		errors: createErrors(fieldCtx),
	};
}

export function createFormControl(id: string, fieldCtx: FieldContext) {
	return {
		labelAttrs: createLabel(id),
		controlAttrs: createControl(id, fieldCtx),
	};
}

const createLabel = (id: string): LabelAttrs => {
	return {
		for: id,
	};
};

const createControl = (
	id: string,
	{ name, fieldErrorsId, descriptionId, errors, constraints }: FieldContext,
) => {
	return derived(
		[name, fieldErrorsId, descriptionId, errors, constraints],
		([$name, $fieldErrorsId, $descriptionId, $errors, $constraints]) => {
			return {
				id,
				name: $name,
				"aria-describedby": getAriaDescribedBy({
					fieldErrorsId: $fieldErrorsId,
					descriptionId: $descriptionId,
					errors: $errors,
				}),
				"aria-invalid": getAriaInvalid($errors),
				"aria-required": getAriaRequired($constraints),
			};
		},
	);
};

const createDescription = ({ descriptionId }: FieldContext) => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const action = (node) => {
		const _id = nanoid();
		descriptionId.set(_id);
	};

	const store = derived([descriptionId], ([$id]) => ({ id: $id }));

	return {
		store,
		action,
	};
};

const createErrors = ({ fieldErrorsId }: FieldContext) => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const action = (node) => {
		const _id = nanoid();
		fieldErrorsId.set(_id);
	};

	const store = derived([fieldErrorsId], ([$id]) => ({ id: $id }));

	return {
		store,
		action,
	};
};
