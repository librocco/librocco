<script lang="ts">
	import type { Hst } from "@histoire/plugin-svelte";
	import { logEvent } from "histoire/client";

	import RemoteDbData from "./RemoteDbData.svelte";
	import { ProgressBar, BadgeColor } from "$lib/components";

	export let Hst: Hst;

	const config = {
		status: "Failed: network error",
		url: "admin:admin@127.0.0.1:5000/dev",
		direction: "sync" as const,
		live: true,
		retry: true
	};

	const status = {
		color: BadgeColor.Success,
		message: "Active"
	};
</script>

<Hst.Story title="Description Lists / RemoteDbData" layout={{ type: "grid", width: 600 }}>
	<Hst.Variant title="Active">
		<RemoteDbData
			{config}
			status={{
				color: BadgeColor.Success,
				message: "Active"
			}}
			onEdit={() => logEvent("edit", "Cancel & edit")}
		>
			<div slot="info" class="flex flex-col gap-y-2 pt-2">
				<ProgressBar />
				<p class="text-xs font-medium uppercase leading-4 text-gray-500">23 Docs Written</p>
			</div>
		</RemoteDbData>
	</Hst.Variant>
	<Hst.Variant title="Error">
		<RemoteDbData
			{config}
			status={{
				color: BadgeColor.Error,
				message: "Error"
			}}
			onEdit={() => logEvent("edit", "Cancel & edit")}
		>
			<div slot="info" class="flex flex-col gap-y-2 pt-2">
				<p class="text-xs font-medium uppercase leading-4 text-gray-500">Network Error</p>
			</div>
		</RemoteDbData>
	</Hst.Variant>
</Hst.Story>
