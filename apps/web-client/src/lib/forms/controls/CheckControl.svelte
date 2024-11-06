<script lang="ts">
	import { getFormFieldCtx, createFormControl } from "./form-field/";
	import { nanoid } from "nanoid";

	export let id = nanoid();
	export let wrapperClass: string;

	const formField = getFormFieldCtx();

	const { labelAttrs, controlAttrs } = createFormControl(id, formField);
</script>

<label {...labelAttrs} class={wrapperClass}>
	<slot controlAttrs={$controlAttrs} />

	<slot name="label" />
</label>
