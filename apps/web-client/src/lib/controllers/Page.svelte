<script lang="ts">
	import type { PluginsInterface } from "$lib/plugins";
	import { appPath } from "$lib/paths";
	import { goto } from "$lib/utils/navigation";

	import { createOutboundNote, getNoteIdSeq } from "$lib/db/note";

	import { PageLayout, ExtensionStatusBanner } from "$lib/components";

	import type { WebClientView } from "@librocco/shared";
	import type { DB } from "$lib/db/types";

	export let db: DB;
	export let plugins: PluginsInterface;

	export let view: WebClientView;
	export let title: string;

	/**
	 * Handle create note is an `on:click` handler used to create a new outbound note
	 * _(and navigate to the newly created note page)_.
	 */
	const handleCreateOutboundNote = async () => {
		const id = await getNoteIdSeq(db);
		await createOutboundNote(db, id);
		await goto(appPath("outbound", id));
	};

	const handleSearch = async () => await goto(appPath("stock"));
</script>

<PageLayout {view} {title} {handleCreateOutboundNote} {handleSearch}>
	<!-- Forward the slots from PageLayout -->
	<slot name="topbar" slot="topbar" let:iconProps let:inputProps {iconProps} {inputProps} />

	<slot name="heading" slot="heading" />

	<slot name="main" slot="main" />

	<svelte:fragment slot="footer">
		<ExtensionStatusBanner {plugins} />
	</svelte:fragment>
</PageLayout>
