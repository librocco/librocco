<script lang="ts" context="module">
	import { z } from "zod";
	import type { Infer } from "sveltekit-superforms";

	export type CustomerOrderMetaSchema = Infer<typeof customerOrderMetaSchema>;
	export const customerOrderMetaSchema = z.object({
		name: z.string().default(""),
		email: z.string().email().default(""),
		deposit: z.number()
	});
</script>

<script lang="ts">
	import { superForm } from "sveltekit-superforms/client";
	import { Save } from "lucide-svelte";

	import { FormFieldProxy, TextControl } from "$lib/forms/controls";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";

	export let saveLabel: string;
	export let heading = "";

	export let data: SuperValidated<CustomerOrderMetaSchema>;
	export let options: FormOptions<CustomerOrderMetaSchema>;
	export let onCancel = () => {};

	const form = superForm(data, options);

	const { form: formStore, enhance, tainted, isTainted } = form;

	$: hasChanges = $tainted && isTainted();
</script>

<form method="POST" class="form gap-y-4" use:enhance data-sveltekit-keepfocus aria-label="Edit customer order name, email or deposit">
	<div class="flex w-full flex-col justify-between gap-y-6 p-6">
		{#if heading}
			<div class="prose">
				<h3>
					{heading}
				</h3>
			</div>
		{/if}

		<div class="form-fields w-full">
			<div class="form-control gap-y-2">
				<FormFieldProxy {form} name="name">
					<TextControl label="Name" let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.name} class="input input-bordered w-full" />
					</TextControl>
				</FormFieldProxy>
			</div>

			<div class="form-control gap-y-2">
				<FormFieldProxy {form} name="email">
					<TextControl label="Email" let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.email} class="input input-bordered w-full" />
					</TextControl>
				</FormFieldProxy>
			</div>

			<div class="form-control max-w-fit gap-y-2">
				<FormFieldProxy {form} name="deposit">
					<TextControl label="Deposit" let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.deposit} class="input input-bordered" type="number" />
					</TextControl>
				</FormFieldProxy>
			</div>
		</div>
	</div>

	<div class="stretch flex w-full gap-x-4 p-6">
		<div class="basis-fit">
			<button on:click={onCancel} class="btn btn-lg btn-secondary btn-outline" type="button">Cancel</button>
		</div>
		<div class="grow">
			<button type="submit" class="btn btn-lg btn-primary w-full" disabled={!hasChanges}>
				<Save aria-hidden="true" focusable="false" size={20} />
				{saveLabel}
			</button>
		</div>
	</div>
</form>
