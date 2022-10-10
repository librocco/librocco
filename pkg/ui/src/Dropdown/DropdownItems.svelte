<script lang="ts">
	export let items = [''];
</script>

<div
	class="absolute right-0 z-10 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
	role="menu"
	aria-orientation="vertical"
	aria-labelledby="menu-button"
	tabindex="-1"
>
	{#each items as item}
		<div class="py-1" role="none">
			<a
				class="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900"
				role="menuitem"
				tabindex="-1"
				id="menu-item-1">{item}</a
			>
		</div>
	{/each}
</div>
