<script lang="ts">
	import { ChevronUp, ChevronDown, Database, ArrowRight, ArrowLeft, ArrowLeftRight } from "lucide-svelte";

	import { Checkbox } from "$lib/components";
	import type { ReplicationConfig } from "$lib/stores/replication";

	const stateColorLookup = {
		success: "badge-green",
		warning: "badge-yellow",
		error: "badge-red"
	};

	export let config: ReplicationConfig;
	export let status: { state: keyof typeof stateColorLookup; message: string };

	export let onEdit: () => void = () => {};

	const directionIconLookup = {
		sync: ArrowLeftRight,
		to: ArrowRight,
		from: ArrowLeft
	};

	$: direction = config.direction.charAt(0).toUpperCase() + config.direction.slice(1);
</script>

<div class="divide-y-gray-50 flex h-auto flex-col gap-y-6 divide-y-2">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<dl class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="flex basis-full flex-col gap-y-2">
				<dt class="text-sm font-medium text-gray-700">Status</dt>
				<dd><span class="badge badge-md {stateColorLookup[status.state]}">{status.message}</span></dd>
				<slot name="info" />
			</div>
			<div class="flex basis-full flex-col gap-y-3">
				<dt class="text-sm font-medium text-gray-700">Remote CouchDB URL</dt>
				<dd class="flex items-center gap-x-2 text-gray-600">
					<Database aria-hidden="true" />
					{config.url}
				</dd>
			</div>
			<div>
				<details>
					<summary class="flex cursor-pointer items-center justify-between py-3">
						<span id="open" class="inline-flex items-center gap-x-2 text-base leading-6 text-gray-600">
							<ChevronUp /> Less details
						</span>
						<span id="closed" class="inline-flex items-center gap-x-2 text-base leading-6 text-gray-600">
							<ChevronDown size={24} /> Connection details
						</span>
					</summary>
					<div class="flex flex-col gap-y-6 pl-8">
						<div class="flex flex-col gap-y-3">
							<dt class="text-sm font-medium text-gray-700">Sync direction</dt>
							<dd class="flex items-center gap-x-2 text-gray-600">
								<svelte:component this={directionIconLookup[config.direction]} aria-hidden="true" />
								{direction}
							</dd>
						</div>
						<div class="flex flex-row-reverse [justify-content:start]">
							<dt class="flex flex-col">
								<span class="text-sm font-medium text-gray-700"> Live </span>
								<span class="text-sm text-gray-500"> Watch for and sync new changes as they become available. </span>
							</dt>
							<dd>
								<span aria-hidden="true">
									<Checkbox disabled checked={config.live} name="live" id="live" label="" />
								</span>
								<span class="sr-only">{config.live}</span>
							</dd>
						</div>
						<div class="flex flex-row-reverse items-start [justify-content:start]">
							<dt class="flex flex-col">
								<span class="text-sm font-medium text-gray-700"> Retry </span>
								<span class="text-sm text-gray-500">
									Automatically retry sync on failure. Otherwise connections will have to be manually restarted.
								</span>
							</dt>
							<dd>
								<span aria-hidden="true">
									<Checkbox disabled checked={config.retry} name="retry" id="retry" label="" />
								</span>
								<span class="sr-only">{config.retry}</span>
							</dd>
						</div>
					</div>
				</details>
			</div>
		</dl>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<button type="submit" class="button button-alert" on:click={() => onEdit()}>Cancel & edit</button>
	</div>
</div>

<style>
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
