<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import { FolderPlus } from "lucide-svelte";

	import { Button, ButtonColor } from "../Button/index";
	import { Header } from "./index";

	export let Hst: Hst;
</script>

<Hst.Story title="Header" layout={{ type: "grid", width: 1000 }}>
	<Hst.Variant title="Default">
		<Header currentLocation="/inventory/stock">
			<Button slot="actionButton" color={ButtonColor.White}>
				<span slot="startAdornment"><FolderPlus /></span>
				Create new warehouse</Button
			>
		</Header>
	</Hst.Variant>
</Hst.Story>
