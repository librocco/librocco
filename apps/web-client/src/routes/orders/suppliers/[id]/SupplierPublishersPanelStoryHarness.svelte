<script lang="ts">
	import SupplierPublishersPanel from "./SupplierPublishersPanel.svelte";

	type AvailablePublisher = {
		name: string;
		supplierName?: string;
	};

	export let supplierName: string;
	export let assignedPublishers: string[];
	export let availablePublishers: AvailablePublisher[];

	let localAssignedPublishers: string[] = [];
	let localAvailablePublishers: AvailablePublisher[] = [];

	let previousAssignedPublishers: string[] | undefined;
	let previousAvailablePublishers: AvailablePublisher[] | undefined;

	const cloneAvailablePublishers = (publishers: AvailablePublisher[]) => publishers.map((publisher) => ({ ...publisher }));

	// Reset the local harness state only when Storybook args change.
	$: if (assignedPublishers !== previousAssignedPublishers || availablePublishers !== previousAvailablePublishers) {
		previousAssignedPublishers = assignedPublishers;
		previousAvailablePublishers = availablePublishers;
		localAssignedPublishers = [...assignedPublishers];
		localAvailablePublishers = cloneAvailablePublishers(availablePublishers);
	}

	const sortPublishers = (publishers: string[]) => [...publishers].sort((left, right) => left.localeCompare(right));

	const sortAvailablePublishers = (publishers: AvailablePublisher[]) =>
		[...publishers].sort((left, right) => left.name.localeCompare(right.name));

	const handleAssignPublisher = (publisherName: string) => {
		const publisher = localAvailablePublishers.find((entry) => entry.name === publisherName);
		if (!publisher) return;

		localAvailablePublishers = sortAvailablePublishers(localAvailablePublishers.filter((entry) => entry.name !== publisherName));
		localAssignedPublishers = sortPublishers([...localAssignedPublishers, publisherName]);
	};

	const handleUnassignPublisher = (publisherName: string) => {
		localAssignedPublishers = localAssignedPublishers.filter((entry) => entry !== publisherName);
		localAvailablePublishers = sortAvailablePublishers([
			...localAvailablePublishers,
			{
				name: publisherName
			}
		]);
	};
</script>

<SupplierPublishersPanel
	{supplierName}
	assignedPublishers={localAssignedPublishers}
	availablePublishers={localAvailablePublishers}
	onAssignPublisher={handleAssignPublisher}
	onUnassignPublisher={handleUnassignPublisher}
/>
