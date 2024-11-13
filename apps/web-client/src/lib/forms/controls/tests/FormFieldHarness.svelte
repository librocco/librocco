<script lang="ts" context="module">
	import type { SuperValidated, FormOptions, Infer } from "sveltekit-superforms";

	import { z } from "zod";

	type TestSchema = Infer<typeof testSchema>;

	export const testSchema = z.object({
		name: z.string().max(2)
	});
</script>

<script lang="ts">
	import { superForm } from "sveltekit-superforms";

	import FormFieldProxy from "../FormFieldProxy.svelte";
	import TextControl from "../TextControl.svelte";

	export let form: SuperValidated<TestSchema>;
	export let options: FormOptions<TestSchema>;

	const _form = superForm(form, options);
</script>

<form use:_form.enhance method="POST">
	<FormFieldProxy form={_form} name="name" let:constraints let:descAttrs let:descAction let:errors let:errAttrs let:errAction>
		<TextControl label="Name" let:controlAttrs>
			<input {...controlAttrs} {...constraints} type="text" />
		</TextControl>

		<span {...descAttrs} use:descAction>Description</span>

		<span {...errAttrs} use:errAction>
			{#each errors as error}
				{error}
			{/each}
		</span>
	</FormFieldProxy>
</form>
