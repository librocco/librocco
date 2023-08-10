<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { logEvent } from "histoire/client";

	import RemoteDbData from "./RemoteDbData.svelte";

	export let Hst: Hst;

	const data = {
		status: "Failed: network error",
		url: "admin:admin@127.0.0.1:5000/dev",
		direction: "sync" as const,
		live: true,
		retry: true,
	}
</script>

<Hst.Story title="Description Lists / RemoteDbData" layout={{ type: "grid", width: 600 }}>
	<RemoteDbData {data} onEdit={() => logEvent("edit", "Cancel & edit")}/>
</Hst.Story>
