<script lang="ts">
	import { Search } from "lucide-svelte";

	import { Page, PlaceholderBox } from "$lib/components";
</script>

<Page>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<h1 class="text-2xl font-bold leading-7 text-gray-900">Stock</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<PlaceholderBox title="Search for stock" description="Get started by searching by title, author, ISBN" class="center-absolute">
			<Search slot="icon" let:iconProps {...iconProps} />
		</PlaceholderBox>
	</svelte:fragment>
</Page>
