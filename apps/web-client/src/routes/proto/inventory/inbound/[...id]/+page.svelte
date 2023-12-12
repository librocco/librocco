<script lang="ts">
	import { QrCode, Trash2, Printer } from "lucide-svelte";

	import { Badge, BadgeColor } from "@librocco/ui";

	import { Page, PlaceholderBox, Breadcrumbs, createBreadcrumbs, Dropdown } from "$lib/components";

	import { generateUpdatedAtString } from "$lib/utils/time";

	import { page } from "$app/stores";

	$: id = $page.params.id.split("/").filter(Boolean).pop();
	$: displayName = id
		.replace(/-/g, " ")
		.split(" ")
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(" ");

	$: note = { id, displayName };
	$: warehouse = { id: "warehouse-1", name: "New Warehouse" };

	$: breadcrumbs = createBreadcrumbs("inbound", warehouse, note);
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<QrCode {...iconProps} />
		<input placeholder="Scan to add books" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<div class="flex w-full items-center justify-between">
			<div>
				<h1 class="mb-2 text-2xl font-bold leading-7 text-gray-900">{displayName}</h1>
				<Badge label="Last updated: {generateUpdatedAtString(new Date())}" color={BadgeColor.Success} />
			</div>

			<div class="flex items-center gap-x-3">
				<button class="rounded-md bg-teal-500 px-[17px] py-[9px] text-green-50 active:bg-teal-400">
					<span class="text-sm font-medium leading-5 text-green-50">Commit</span>
				</button>

				<Dropdown>
					<button class="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal leading-5"
						><Printer class="text-gray-400" size={20} /><span class="text-gray-700">Print</span></button
					>
					<button class="flex w-full items-center gap-2 bg-red-400 px-4 py-3 text-sm font-normal leading-5"
						><Trash2 class="text-white" size={20} /><span class="text-white">Delete</span></button
					>
				</Dropdown>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<PlaceholderBox title="Scan to add books" description="Plugin your barcode scanner and pull the trigger" class="center-absolute">
			<QrCode slot="icon" let:iconProps {...iconProps} />
		</PlaceholderBox>
	</svelte:fragment>
</Page>
