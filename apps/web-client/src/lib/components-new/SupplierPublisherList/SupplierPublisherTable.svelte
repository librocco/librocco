<script lang="ts">
	import { createEventDispatcher } from "svelte";

	interface $$Slots {
		title: Record<string, never>; // Slot for the table title/header
		"action-label": {
			// Slot for the action button text
			publisher: string;
		};
		"header-label": Record<string, never>; // Slot for the table header label
		"empty-state": Record<string, never>; // Optional slot for empty state message
	}

	export let publishers: string[];

	const dispatch = createEventDispatcher<{ action: { publisher: string } }>();
</script>

<div class="prose w-full">
	<div class="relative max-h-[208px] w-full overflow-y-auto rounded border border-gray-200">
		<table class="!my-0 flex-col items-stretch overflow-y-auto">
			<thead class="sticky left-0 right-0 top-0 bg-white shadow">
				<tr>
					<th scope="col" class="px-2 py-2">
						<slot name="header-label">Publisher</slot>
					</th>
					<th scope="col" class="px-2 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each publishers as publisher}
					<tr class="hover flex w-full justify-between focus-within:bg-base-200">
						<td class="px-2">{publisher}</td>
						<td class="px-2 text-end">
							<button on:click={() => dispatch("action", { publisher })} class="btn-primary btn-xs btn flex-nowrap gap-x-2.5 rounded-lg">
								<slot name="action-label" {publisher} />
							</button>
						</td>
					</tr>
				{:else}
					<slot name="empty-state">
						<tr>
							<td colspan="2" class="px-2 py-4 text-center text-gray-500"> No publishers </td>
						</tr>
					</slot>
				{/each}
			</tbody>
		</table>
	</div>
</div>
