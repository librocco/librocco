<script lang="ts">
	import { Search } from "lucide-svelte";

	import { Page, PlaceholderBox, Breadcrumbs, createBreadcrumbs } from "$lib/components";

	import { page } from "$app/stores";

	$: id = $page.params.id.split("/").filter(Boolean).pop();
	$: displayName = id
		.replace(/-/g, " ")
		.split(" ")
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(" ");

	$: breadcrumbs = createBreadcrumbs("warehouse", { id, displayName });
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<Breadcrumbs class="mb-3" links={breadcrumbs} />
		<h1 class="mb-2 text-2xl font-bold leading-7 text-gray-900">{displayName}</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<PlaceholderBox title="Add new inbound note" description="Get started by adding a new note" class="center-absolute">
			<button class="mx-auto flex items-center gap-2 rounded-md bg-teal-500  py-[9px] pl-[15px] pr-[17px]"
				><span class="text-green-50">New note</span></button
			>
		</PlaceholderBox>
	</svelte:fragment>
</Page>
