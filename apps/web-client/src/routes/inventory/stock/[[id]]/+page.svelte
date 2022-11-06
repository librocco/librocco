<script lang="ts">
	import { Search } from 'lucide-svelte';

	import { InventoryPage, SidebarItem, TextField, Pagination } from '@librocco/ui';
</script>

<InventoryPage>
	<!-- Header slot -->
	<div class="flex h-[168px] w-full items-center justify-center bg-gray-200" slot="header">
		<h1 class="text-3xl font-semibold tracking-wider text-gray-300">HEADER</h1>
	</div>

	<!-- Sidebar slot -->
	<nav class="divide-y divide-gray-300" slot="sidebar">
		<SidebarItem href="#" name="All" current />
		<SidebarItem href="#" name="Varia 2018" />
		<SidebarItem href="#" name="Scolastica 2021" />
		<SidebarItem href="#" name="Nuovo 2022" />
	</nav>

	<!-- Table header slot -->
	<div class="flex w-full items-end justify-between" slot="tableHeader">
		<h1 class="cursor-normal select-none text-lg font-semibold text-gray-900">All</h1>
		<TextField name="search" placeholder="Serach">
			<svelte:fragment slot="startAdornment">
				<Search class="h-5 w-5" />
			</svelte:fragment>
		</TextField>
	</div>

	<!-- Table slot -->
	<div class="flex h-full w-full items-center justify-center bg-violet-200" slot="table">
		<h1 class="text-3xl font-semibold tracking-wider text-violet-300">TABLE</h1>
	</div>

	<!-- Table footer slot -->
	<div slot="tableFooter">
		<div class="flex items-center justify-between">
			<p class="cursor-normal select-none text-sm font-medium leading-5">
				Showing <strong>1</strong> to <strong>10</strong> of <strong>97</strong> results
			</p>
			<Pagination maxItems={7} value={0} numPages={10} />
		</div>
	</div>
</InventoryPage>
