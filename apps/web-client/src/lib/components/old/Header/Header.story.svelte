<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import { User } from "lucide-svelte";

	import { Header } from "./index";

	export let Hst: Hst;

	const links = [
		{
			label: "Stock",
			href: "/inventory/stock"
		},
		{
			label: "Inbound",
			href: "/inventory/inbound"
		},
		{
			label: "Outbound",
			href: "/inventory/outbound"
		}
	];
</script>

<Hst.Story title="Header" layout={{ type: "grid", width: 1000 }}>
	<Hst.Variant title="Default">
		<Header currentLocation="/inventory/stock" {links}>
			<User size={36} color="white" />
		</Header>
	</Hst.Variant>
</Hst.Story>
