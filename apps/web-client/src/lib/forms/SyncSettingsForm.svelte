<script lang="ts">
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { superForm } from "sveltekit-superforms/client";
	import type { Writable } from "svelte/store";
	import compare from "just-compare";

	import { Input } from "$lib/components";
	import type { SyncSettingsSchema } from "./schemas";

	export let data: SuperValidated<SyncSettingsSchema>;
	export let options: FormOptions<SyncSettingsSchema>;
	export let active: Writable<boolean>;

	const _form = superForm(data, options);

	const { form: formStore, enhance, tainted } = _form;

	$: hasChanges = $tainted && !compare($formStore, data.data);
</script>

<form class="divide-y-secondary flex flex-col gap-y-10 px-4 py-4" use:enhance method="POST" aria-label="Edit remote database connection config">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">Database Name (this will probably change in the future)</span>
				</div>
				<input id="url" name="dbid" bind:value={$formStore.dbid} class="input input-bordered w-full" />
			</label>

			<label class="form-control basis-full">
				<div class="label">
					<span class="label-text">Remote Sync Database URL</span>
				</div>
				<input id="url" name="url" bind:value={$formStore.url} class="input input-bordered w-full" />
			</label>
		</div>
	</div>

	<div class="flex items-center justify-between gap-x-2">
		<div class="flex items-center gap-x-2">
			<span class="w-10 text-center {$active ? '' : 'font-bold text-red-500'}">OFF</span>
			<input type="checkbox" bind:checked={$active} class="toggle" />
			<span class="w-10 text-center {$active ? 'font-bold text-green-500' : ''}">ON</span>
		</div>

		<button type="submit" class="btn btn-primary disabled:bg-gray-400" disabled={!hasChanges}>Save and Reload</button>
	</div>
</form>
