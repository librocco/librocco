<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { UserRound } from "lucide-svelte";

	import { HeadCol, BodyMultiRow } from "../Cells";

	export let Hst: Hst;
</script>

<Hst.Story title="Tables / Cells">
	<Hst.Variant title="Head Column">
		<HeadCol label="Customer" icon={UserRound} />
	</Hst.Variant>
	<Hst.Variant title="Body Multi-row">
		<BodyMultiRow
			rows={{
				name: { data: "Christopher De Sousa", className: "text-md font-medium" },
				email: { data: "chris@cool.com", className: "text-md font-light" }
			}}
		/>
	</Hst.Variant>
</Hst.Story>
