<script lang="ts" context="module">
	import type { SuperForm } from "sveltekit-superforms/client";

	type RemoteDbForm = SuperForm<ZodValidation<typeof remoteDbSchema>, unknown>;
	export type RemoteDbFormOptions = RemoteDbForm["options"];
</script>

<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync, fieldProxy } from "sveltekit-superforms/client";

	import { ChevronUp, ChevronDown } from "lucide-svelte";

	import { Input, Checkbox } from "$lib/components";

	import { remoteDbSchema, type RemoteDbData } from "$lib/forms/schemas";

	export let data: RemoteDbData | null;
	export let options: RemoteDbFormOptions;

	const _form = superValidateSync(data, remoteDbSchema);
	const form = superForm(_form, options);

	const { form: formStore, enhance } = form;

	const liveProxy = fieldProxy(formStore, "live");
	const retryProxy = fieldProxy(formStore, "retry");
</script>

<form
	class="divide-y-gray-50 flex h-auto flex-col gap-y-6 divide-y-2"
	use:enhance
	method="POST"
	aria-label="Edit remote database connection config"
>
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<Input
					id="url"
					name="url"
					label="Remote CouchDB URL"
					required={true}
					pattern="^(https?://)(.+):(.+)@(.+):(.+)$"
					bind:value={$formStore.url}
				>
					<p slot="helpText">URL format: <span class="italic">https://user:password@host:post/db_name</span></p>
				</Input>
			</div>
			<div>
				<details>
					<summary class="flex cursor-pointer items-center justify-between py-3">
						<span id="open" class="inline-flex items-center gap-x-2 text-base leading-6 text-gray-600">
							<ChevronUp /> Less options
						</span>
						<span id="closed" class="inline-flex items-center gap-x-2 text-base leading-6 text-gray-600">
							<ChevronDown size={24} /> More options
						</span>
					</summary>
					<div class="flex flex-col gap-y-6 pl-8">
						<div class="flex flex-col gap-y-2">
							<label for="direction" class={"text-sm font-medium text-gray-700"}> Sync direction </label>
							<select id="direction" name="direction" class="appearance-none" bind:value={$formStore.direction}>
								<option value="to">➡️ To remote</option>
								<option value="from">⬅️ From remote</option>
								<option value="sync">↔️ Sync with remote</option>
							</select>
						</div>
						<Checkbox
							id="live"
							name="live"
							label="Live"
							helpText="Watch for and sync new changes as they become available."
							bind:checked={$formStore.live}
							on:change={() => {
								if ($formStore.retry) {
									retryProxy.set(false);
									liveProxy.set(false);
								}
							}}
						/>
						<Checkbox
							id="retry"
							name="retry"
							label="Retry"
							helpText="Automatically retry sync on failure. Otherwise connections will have to be manually restarted."
							disabled={!$formStore.live}
							bind:checked={$formStore.retry}
						/>
					</div>
				</details>
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<button type="submit" class="button button-green">Start sync</button>
	</div>
</form>

<style>
	/** Select styles */
	select {
		border-radius: 6px;
		border-width: 1px;
		/** gray-300 */
		border-color: rgb(209 213 219);
	}

	select:focus {
		outline: none;
		outline-style: none;
		box-shadow: none;
		/** teal-500 */
		outline: 2px solid rgb(20 184 166);
	}

	/** Details styles */
	details summary::-webkit-details-marker {
		display: none;
	}

	details > summary > span {
		transition-property: opacity;
		transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
		transition-duration: 200ms;
	}

	details > summary > #open {
		visibility: hidden;
		width: 0;
		margin-left: 0;
		opacity: 0;
	}

	details[open] > summary > #open {
		visibility: visible;
		width: fit-content;
		margin-right: auto;
		opacity: 100;
	}

	details > summary > #closed {
		visibility: visible;
		width: fit-content;
		margin-right: auto;
		opacity: 100;
	}

	details[open] > summary > #closed {
		visibility: hidden;
		width: 0;
		margin-left: 0;
		opacity: 0;
	}

	@keyframes open {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}

	details[open] summary ~ * {
		animation: open 0.2s;
	}
</style>
