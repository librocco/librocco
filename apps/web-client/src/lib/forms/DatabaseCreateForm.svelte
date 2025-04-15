<script lang="ts">
	import { superForm, defaults } from "sveltekit-superforms/client";
	import { zod } from "sveltekit-superforms/adapters";

	import { databaseCreateSchema, type DatabaseCreateFormSchema } from "$lib/forms/schemas";
	import { Input } from "$lib/components/FormControls";

	import type { FormOptions } from "sveltekit-superforms/client";

	export let options: FormOptions<DatabaseCreateFormSchema>;
	/**
	 * Handle click of "X" icon button
	 */
	export let onCancel: (e: Event) => void = () => {};

	const form = superForm(defaults(zod(databaseCreateSchema)), options);

	const { form: formStore, constraints, enhance } = form;
</script>

<form class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4" aria-label="Create new database" use:enhance method="POST" id="database-create-form">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">Name</span>
				</div>
				<input bind:value={$formStore.name} name="name" placeholder="Database name" {...$constraints.name} class="input input-bordered w-full" />
			</label>
		</div>
	</div>
	<div class="flex w-full justify-end gap-x-2">
		<button class="btn btn-secondary btn-outline" on:click={onCancel} type="button">Cancel</button>
		<button class="btn btn-primary disabled:bg-gray-400" type="submit">Save</button>
	</div>
</form>
