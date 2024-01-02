<nav aria-label="Sidebar">
	<div class="flex flex-col divide-y-2">
		<slot />
	</div>
	{#if $$slots.actions}
		<div class="border-t border-dashed border-gray-300">
			<slot name="actions" />
		</div>
	{/if}
</nav>
