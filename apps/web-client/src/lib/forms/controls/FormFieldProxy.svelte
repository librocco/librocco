<script lang="ts" context="module">
	type T = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
	import { setFormFieldCtx } from "./form-field/context";
	import { extractErrorArray, getValueAtPath } from "./form-field/utils";

	import { writable } from "svelte/store";

	import { createFormField } from "./form-field/create";

	import { type SuperForm, type FormPath } from "sveltekit-superforms";

	export let form: SuperForm<T>;

	export let name: FormPath<T>;

	$: ({
		errors: formErrors,
		constraints: formConstraints,
		tainted: formTainted,
		form: formData,
	} = form);

	const _field = {
		name: writable(name),
		errors: writable([]),
		constraints: writable({}),
		tainted: writable(false),
		fieldErrorsId: writable<string>(),
		descriptionId: writable<string>(),
	};

	$: _field.errors.set(extractErrorArray(getValueAtPath(name, $formErrors)));
	$: _field.constraints.set(getValueAtPath(name, $formConstraints) ?? {});
	$: _field.tainted.set($formTainted ? getValueAtPath(name, $formTainted) === true : false);

	const {
		description: { store: descAttrs, action: descAction },
		errors: { store: errAttrs, action: errAction },
	} = createFormField(_field);

	const { errors: _errors, constraints: _constraints } = _field;

	// Set field context so that we can use it to in TextControl & CheckControl components
	// when creating the text control context
	setFormFieldCtx(_field);
</script>

<slot
	value={$formData[name]}
	errors={$_errors}
	constraints={$_constraints}
	descAttrs={$descAttrs}
	errAttrs={$errAttrs}
	{descAction}
	{errAction}
/>
