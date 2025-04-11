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

<form class="flex h-auto flex-col gap-y-6" use:enhance method="POST" aria-label="Edit remote database connection config">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<Input id="url" name="dbid" label="Database Name (this will probably change in the future)" bind:value={$formStore.dbid} />
			</div>

			<div class="basis-full">
				<Input id="url" name="url" label="Remote Sync Database URL" bind:value={$formStore.url} />
			</div>
		</div>
	</div>

	<div class="flex items-center justify-between gap-x-2 px-4 py-6">
		<div class="flex items-center gap-x-2">
			<span class="w-10 text-center {$active ? '' : 'font-bold text-red-500'}">OFF</span>
			<input type="checkbox" bind:checked={$active} class="toggle" />
			<span class="w-10 text-center {$active ? 'font-bold text-green-500' : ''}">ON</span>
		</div>

		<button type="submit" class="button button-green" disabled={!hasChanges}>Save and Reload</button>
	</div>
</form>
