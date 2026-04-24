<script lang="ts">
	interface $$Slots {
		title: Record<string, never>;
		badge: Record<string, never>;
		default: Record<string, never>;
		"empty-state": Record<string, never>;
	}

	export let showEmptyState: boolean = false;
	export let emptyStateMessage: string = "No items";
</script>

<div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded border border-base-300 bg-base-100 text-base-content">
	<div class="sticky top-0 z-10 border-b border-base-300 bg-base-200/60 px-3 py-2">
		<div class="flex items-center gap-2">
			<h3 class="text-[14px] font-normal text-base-content">
				<slot name="title" />
			</h3>
			<slot name="badge" />
		</div>
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if showEmptyState}
			<slot name="empty-state">
				<div class="py-8 px-3 text-center text-sm text-base-content/60">
					{emptyStateMessage}
				</div>
			</slot>
		{:else}
			<slot />
		{/if}
	</div>
</div>
