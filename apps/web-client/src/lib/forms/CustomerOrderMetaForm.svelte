<script lang="ts">
	import { superForm } from "sveltekit-superforms/client";
	import Save from "$lucide/save";

	import { FormFieldProxy, TextControl } from "$lib/forms/controls";

	import type { CustomerOrderSchema } from "./schemas";
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let saveLabel: string;
	export let heading = "";
	export let kind: "create" | "update";

	export let data: SuperValidated<CustomerOrderSchema>;
	export let options: FormOptions<CustomerOrderSchema>;
	export let onCancel = () => {};

	const form = superForm(data, options);

	const { form: formStore, enhance, tainted, isTainted } = form;

	$: hasChanges = $tainted && isTainted();
</script>

<form method="POST" class="form gap-y-4" use:enhance data-sveltekit-keepfocus aria-label={$LL.forms.customer_order_meta.aria.form()}>
	<div class="flex w-full flex-col justify-between gap-y-6 p-6">
		{#if heading}
			<div class="prose">
				<h3>
					{heading}
				</h3>
			</div>
		{/if}

		<div class="form-fields w-full">
			{#if kind === "update"}
				<div class="form-control gap-y-2">
					<FormFieldProxy {form} name="displayId">
						<TextControl label={$LL.forms.customer_order_meta.labels.display_id()} let:controlAttrs>
							<input {...controlAttrs} bind:value={$formStore.displayId} class="input-bordered input w-full" />
						</TextControl>
					</FormFieldProxy>
				</div>
			{/if}

			<div class="form-control gap-y-2">
				<FormFieldProxy {form} name="fullname">
					<TextControl label={$LL.forms.customer_order_meta.labels.name()} let:controlAttrs>
						<input {...controlAttrs} bind:value={$formStore.fullname} class="input-bordered input w-full" />
					</TextControl>
				</FormFieldProxy>
			</div>
			<div class="grid grid-cols-4 gap-4">
				<div class="form-control col-span-3 gap-y-2">
					<FormFieldProxy {form} name="email">
						<TextControl label={$LL.forms.customer_order_meta.labels.email()} let:controlAttrs>
							<input {...controlAttrs} bind:value={$formStore.email} class="input-bordered input w-full" />
						</TextControl>
					</FormFieldProxy>
				</div>
				<div class="form-control gap-y-2">
					<FormFieldProxy {form} name="deposit">
						<TextControl label={$LL.forms.customer_order_meta.labels.deposit()} let:controlAttrs>
							<input {...controlAttrs} bind:value={$formStore.deposit} class="input-bordered input" type="number" />
						</TextControl>
					</FormFieldProxy>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="form-control gap-y-2">
					<FormFieldProxy {form} name="phone1">
						<TextControl label={$LL.forms.customer_order_meta.labels.phone1()} let:controlAttrs>
							<input {...controlAttrs} bind:value={$formStore.phone1} class="input-bordered input w-full" />
						</TextControl>
					</FormFieldProxy>
				</div>
				<div class="form-control gap-y-2">
					<FormFieldProxy {form} name="phone2">
						<TextControl label={$LL.forms.customer_order_meta.labels.phone2()} let:controlAttrs>
							<input {...controlAttrs} bind:value={$formStore.phone2} class="input-bordered input w-full" />
						</TextControl>
					</FormFieldProxy>
				</div>
			</div>
		</div>
	</div>

	<div class="stretch flex w-full gap-x-4 p-6">
		<div class="basis-fit">
			<button on:click={onCancel} class="btn-secondary btn-outline btn-lg btn" type="button"
				>{$LL.forms.customer_order_meta.labels.cancel_button()}</button
			>
		</div>
		<div class="grow">
			<button type="submit" class="btn-primary btn-lg btn w-full" disabled={!hasChanges}>
				<Save aria-hidden="true" focusable="false" size={20} />
				{saveLabel}
			</button>
		</div>
	</div>
</form>
