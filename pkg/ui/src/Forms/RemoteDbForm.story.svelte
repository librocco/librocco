<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { logEvent } from "histoire/client";

	import RemoteDbForm from "./RemoteDbForm.svelte";

	export let Hst: Hst;
</script>

<Hst.Story title="Forms / RemoteDbForm" layout={{ type: "grid", width: 600 }}>
	<RemoteDbForm onSubmit={(values) => logEvent("submit", values)}/>
</Hst.Story>
