<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";

	import Toast from "./Toast.svelte";
	import { ToastType } from "./enums";

	export let Hst: Hst;
</script>

<Hst.Story title="Toast" layout={{ type: "grid", width: 500 }}>
	<div class="m-4 flex flex-col gap-y-6">
		<Toast type={ToastType.Success}>Note updated</Toast>
		<Toast type={ToastType.Error}>Something went wrong. Please try again</Toast>
	</div>
</Hst.Story>
