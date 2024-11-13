<script lang="ts">
	import { getFormFieldCtx, createFormControl } from "./form-field/";
	import { nanoid } from "nanoid";

	export let id = nanoid();
	export let label: string = "";

	const formField = getFormFieldCtx();

	const { labelAttrs, controlAttrs } = createFormControl(id, formField);

	const required = $controlAttrs["aria-required"] === "true";
</script>

<div class="flex flex-col gap-y-2">
	<slot name="label" {required} {labelAttrs}>
		<!--svelte-ignore a11y-label-has-associated-control 
        	we can ignore this as `for` is defined in the `labelAttrs`
    	-->
		<label
			{...labelAttrs}
			class="label-text select-none font-medium
			{required ? 'required_input_label' : ''}"
		>
			{label}
		</label>
	</slot>

	<!-- slot for input -->
	<slot controlAttrs={$controlAttrs} />
</div>
