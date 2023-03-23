<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { Settings2 } from "lucide-svelte";

	import { Dropdown, DropdownItem } from "./index";

	export let Hst: Hst;

	const items = [
		{ label: "Edit", href: "#edit" },
		{ label: "Archive", href: "#archive" },
		{ label: "Move", href: "#move" },
		{ label: "Share", href: "#share" },
		{ label: "Add To Favorites", href: "#add-to-favourites" },
		{ label: "Delete", href: "#delete" }
	];
</script>

<Hst.Story title="Dropdown" layout={{ type: "grid" }}>
	<Dropdown buttonLabel="Options" {items}>
		<div slot="buttonIcon"><Settings2 /></div>
		<div slot="items">
			{#each items as { label, href }, ix (ix)}
				<DropdownItem {label} {href} index={ix} listLength={items.length} />
			{/each}
		</div>
	</Dropdown>
</Hst.Story>
