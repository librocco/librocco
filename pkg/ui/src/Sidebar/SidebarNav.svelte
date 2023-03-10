<nav aria-label="Sidebar" class="bg-white px-2">
	<div class="flex flex-1 flex-col divide-y-2">
		<slot />
	</div>
	<div class="border-t border-dashed border-gray-300">
		<slot name="actions" />
	</div>
</nav>
