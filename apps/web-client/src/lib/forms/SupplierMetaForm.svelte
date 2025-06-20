<script lang="ts">
	import { superForm } from "sveltekit-superforms/client";
	import Save from "$lucide/save";

	import { FormFieldProxy, TextControl } from "$lib/forms/controls";

	import type { SupplierSchema } from "./schemas";
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";

	export let saveLabel: string;
	export let heading = "";

	export let data: SuperValidated<SupplierSchema>;
	export let options: FormOptions<SupplierSchema>;
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
						<input {...controlAttrs} bind:value={$formStore.name} class="input-bordered input w-full" />
					</TextControl>
				</FormFieldProxy>
			</div>

			<div class="form-control gap-y-2">
				<FormFieldProxy {form} name="email">
					<TextControl label="Email" let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.email} class="input-bordered input w-full" />
					</TextControl>
				</FormFieldProxy>
			</div>

			<div class="form-control gap-y-2">
				<FormFieldProxy {form} name="address">
					<TextControl label="Address" let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.address} class="input-bordered input w-full" />
					</TextControl>
				</FormFieldProxy>
			</div>
			<div class="form-control gap-y-2">
				<FormFieldProxy {form} name="address">
					<TextControl label="Customer ID" let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.customerId} class="input-bordered input w-full" type="number" />
					</TextControl>
				</FormFieldProxy>
			</div>
		</div>
	</div>

	<div class="stretch flex w-full gap-x-4 p-6">
		<div class="basis-fit">
			<button on:click={onCancel} class="btn-secondary btn-outline btn-lg btn" type="button">Cancel</button>
		</div>
		<div class="grow">
			<button type="submit" class="btn-primary btn-lg btn w-full" disabled={!hasChanges}>
				<Save aria-hidden="true" focusable="false" size={20} />
				{saveLabel}
			</button>
		</div>
	</div>
</form>
