<script lang="ts">
	import type { PageData } from "./$types";

	import { associatePublisher, removePublisherFromSupplier } from "$lib/db/cr-sqlite/suppliers";
	import SupplierPublishersPanel from "./SupplierPublishersPanel.svelte";

	import { app } from "$lib/app";
	import { getDb } from "$lib/app/db";

	export let data: PageData;

	$: ({ supplier, assignedPublishers, availablePublishers } = data);

	const handleAssignPublisher = async (publisher: string) => {
		const db = await getDb(app);
		await associatePublisher(db, supplier.id, publisher);
	};

	const handleUnassignPublisher = async (publisher: string) => {
		const db = await getDb(app);
		await removePublisherFromSupplier(db, supplier.id, publisher);
	};
</script>

<SupplierPublishersPanel
	supplierName={supplier.name}
	{assignedPublishers}
	{availablePublishers}
	onAssignPublisher={handleAssignPublisher}
	onUnassignPublisher={handleUnassignPublisher}
/>
