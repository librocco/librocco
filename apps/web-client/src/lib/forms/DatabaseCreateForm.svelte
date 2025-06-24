<script lang="ts">
	import { superForm, defaults } from "sveltekit-superforms/client";
	import { zod } from "sveltekit-superforms/adapters";

	import { databaseCreateSchema, type DatabaseCreateFormSchema } from "$lib/forms/schemas";
	import { Input } from "$lib/components/FormControls";

	import type { FormOptions } from "sveltekit-superforms/client";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let options: FormOptions<DatabaseCreateFormSchema>;
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(defaults(zod(databaseCreateSchema)), options);

	const { form: formStore, constraints, enhance } = form;
</script>

<form
	class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4"
	aria-label={$LL.forms.database_create.aria.form()}
	use:enhance
	method="POST"
	id="database-create-form"
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">{$LL.forms.database_create.labels.name()}</span>
				</div>
				<input
					bind:value={$formStore.name}
					name="name"
					placeholder={$LL.forms.database_create.placeholders.name()}
					{...$constraints.name}
					class="input-bordered input w-full"
				/>
			</label>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="btn-secondary btn-outline btn" on:click={onCancel} type="button"
			>{$LL.forms.database_create.labels.cancel_button()}</button
		>
		<button class="btn-primary btn disabled:bg-gray-400" type="submit">{$LL.forms.database_create.labels.save_button()}</button>
	</div>
</form>
