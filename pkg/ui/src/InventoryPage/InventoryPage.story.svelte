<script lang="ts">
	import { Search, Check, ChevronDown } from 'lucide-svelte';
	import type { Hst } from '@histoire/plugin-svelte';

	import { Pagination } from '../Pagination';
	import { TextField } from '../FormFields';
	import { SidebarItem, SidebarItemGroup } from '../Sidebar';
	import { Badge, BadgeColor } from '../Badge';

	import InventoryPage from './InventoryPage.svelte';

	export let Hst: Hst;
</script>

<Hst.Story title="Inventory Page">
	<Hst.Variant title="Layout">
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

	<Hst.Variant title="Prototype: Stock">
		<InventoryPage>
			<div class="flex h-[168px] w-full items-center justify-center bg-gray-200" slot="header">
				<h1 class="text-3xl font-semibold tracking-wider text-gray-300">HEADER</h1>
			</div>
			<nav class="divide-y divide-gray-300" slot="sidebar">
				<SidebarItem href="#" name="All" current />
				<SidebarItem href="#" name="Varia 2018" />
				<SidebarItem href="#" name="Scolastica 2021" />
				<SidebarItem href="#" name="Nuovo 2022" />
			</nav>
			<div class="flex w-full items-end justify-between" slot="tableHeader">
				<h1 class="cursor-normal select-none text-lg font-semibold text-gray-900">All</h1>
				<TextField name="search" placeholder="Serach">
					<svelte:fragment slot="startAdornment">
						<Search class="h-5 w-5" />
					</svelte:fragment>
				</TextField>
			</div>
			<div class="flex h-full w-full items-center justify-center bg-violet-200" slot="table">
				<h1 class="text-3xl font-semibold tracking-wider text-violet-300">TABLE</h1>
			</div>
			<div slot="tableFooter">
				<div class="flex items-center justify-between">
					<p class="cursor-normal select-none text-sm font-medium leading-5">
						Showing <strong>1</strong> to <strong>10</strong> of <strong>97</strong> results
					</p>
					<Pagination maxItems={7} value={0} numPages={10} />
				</div>
			</div>
		</InventoryPage>
	</Hst.Variant>

	<Hst.Variant title="Prototype: Inbound">
		<InventoryPage>
			<div class="flex h-[168px] w-full items-center justify-center bg-gray-200" slot="header">
				<h1 class="text-3xl font-semibold tracking-wider text-gray-300">HEADER</h1>
			</div>
			<nav class="divide-y divide-gray-300" slot="sidebar">
				<SidebarItemGroup name="Nuovo 2022" index={0} items={[]} />
				<SidebarItemGroup
					name="Scolastica 2021"
					index={1}
					items={[{ name: 'John', current: false, href: '' }]}
					expanded
				/>
				<SidebarItemGroup
					index={2}
					name="Varia 2018"
					items={[
						{ name: 'Silvio', href: '', current: true },
						{ name: 'Sandra', href: '', current: false },
						{ name: 'Timo', href: '', current: false }
					]}
					expanded
				/>
			</nav>
			<div class="flex w-full items-end justify-between" slot="tableHeader">
				<div>
					<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
						<span class="align-middle">Silvio </span>
						<span class="align-middle text-sm font-normal text-gray-500">in Varia 2018</span>
					</h2>
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<TextField name="commit-status" placeholder="Draft">
							<Check class="h-5 w-5" slot="startAdornment" />
							<ChevronDown class="h-5 w-5 text-gray-500" slot="endAdornment" />
						</TextField>
						<Badge label="Last updated: 20:58" color={BadgeColor.Success} />
					</div>
				</div>
				<TextField name="search" placeholder="Serach">
					<Search slot="startAdornment" class="h-5 w-5" />
				</TextField>
			</div>
			<div class="flex h-full w-full items-center justify-center bg-violet-200" slot="table">
				<h1 class="text-3xl font-semibold tracking-wider text-violet-300">TABLE</h1>
			</div>
			<div class="flex h-full items-center justify-between" slot="tableFooter">
				<p class="cursor-normal select-none text-sm font-medium leading-5">
					Showing <strong>1</strong> to <strong>10</strong> of <strong>97</strong> results
				</p>
				<Pagination maxItems={7} value={0} numPages={10} />
			</div>
		</InventoryPage>
	</Hst.Variant>

	<Hst.Variant title="Prototype: Outbound">
		<InventoryPage>
			<div class="flex h-[168px] w-full items-center justify-center bg-gray-200" slot="header">
				<h1 class="text-3xl font-semibold tracking-wider text-gray-300">HEADER</h1>
			</div>
			<nav class="divide-y divide-gray-300" slot="sidebar">
				<SidebarItem name="Silvio" href="" current />
				<SidebarItem name="Sandra" href="" />
			</nav>
			<div class="flex w-full items-end justify-between" slot="tableHeader">
				<div>
					<h2 class="cursor-normal mb-4 select-none text-lg font-medium text-gray-900">
						<span class="align-middle">Silvio OUT</span>
					</h2>
					<div class="flex items-center gap-1.5 whitespace-nowrap">
						<TextField name="commit-status" placeholder="Draft">
							<Check class="h-5 w-5" slot="startAdornment" />
							<ChevronDown class="h-5 w-5 text-gray-500" slot="endAdornment" />
						</TextField>
						<Badge label="Last updated: 20:58" color={BadgeColor.Success} />
					</div>
				</div>
				<TextField name="search" placeholder="Serach">
					<Search slot="startAdornment" class="h-5 w-5" />
				</TextField>
			</div>
			<div class="flex h-full w-full items-center justify-center bg-violet-200" slot="table">
				<h1 class="text-3xl font-semibold tracking-wider text-violet-300">TABLE</h1>
			</div>
			<div class="flex h-full items-center justify-between" slot="tableFooter">
				<p class="cursor-normal select-none text-sm font-medium leading-5">
					Showing <strong>1</strong> to <strong>10</strong> of <strong>97</strong> results
				</p>
				<Pagination maxItems={7} value={0} numPages={10} />
			</div>
		</InventoryPage>
	</Hst.Variant>
</Hst.Story>
