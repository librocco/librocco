<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { SidebarItem, SideBarNav } from '../Sidebar';
	import InventoryPage from './InventoryPage.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Inventory Page">
	<Hst.Variant title="Inventory Page">
		<InventoryPage>
			<div class="flex h-[168px] w-full items-center justify-center bg-gray-200" slot="header">
				<h1 class="text-3xl font-semibold tracking-wider text-gray-300">HEADER</h1>
			</div>

			<div class="flex h-full w-full items-center justify-center bg-red-200" slot="sidebar">
				<h1 class="text-3xl font-semibold tracking-wider text-red-300">SIDEBAR</h1>
			</div>

			<div class="flex h-20 w-full items-center justify-center bg-green-200" slot="tableHeader">
				<h1 class="text-3xl font-semibold tracking-wider text-green-300">TABLE HEADER</h1>
			</div>

			<div class="flex h-full w-full items-center justify-center bg-violet-200" slot="table">
				<h1 class="text-3xl font-semibold tracking-wider text-violet-300">TABLE</h1>
			</div>

			<div class="flex h-14 items-center justify-center bg-blue-200" slot="tableFooter">
				<h1 class="text-3xl font-semibold tracking-wider text-blue-300">TABLE FOOTER</h1>
			</div>
		</InventoryPage>
	</Hst.Variant>
</Hst.Story>
