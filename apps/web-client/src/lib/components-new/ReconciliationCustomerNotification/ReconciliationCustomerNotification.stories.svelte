<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import ReconciliationCustomerNotification from "./ReconciliationCustomerNotification.svelte";

	export const meta: Meta = {
		title: "Reconciliation Customer Notification",
		component: ReconciliationCustomerNotification
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	const booksData = [
		{
			isbn: "123",
			title: "The Great Gatsby",
			total: 2,
			customers: [
				{ fullname: "Sarah Johnson", customer_display_id: "1", created: new Date("2024-12-15T10:30:00") },
				{ fullname: "Michael Chen", customer_display_id: "2", created: new Date("2024-12-16T14:20:00") }
			]
		},
		{
			isbn: "321",
			title: "To Kill a Mockingbird",
			total: 1,
			customers: [{ fullname: "James Taylor", customer_display_id: "6", created: new Date("2024-12-15T13:00:00") }]
		},
		{
			isbn: "456",
			title: "1984",
			total: 1,
			customers: [{ fullname: "Jennifer Lee", customer_display_id: "9", created: new Date("2024-12-14T09:00:00") }]
		}
	];

	const singleBookData = [
		{
			isbn: "789",
			title: "Pride and Prejudice",
			total: 3,
			customers: [
				{ fullname: "Emma Watson", customer_display_id: "10", created: new Date("2024-12-12T23:45:00") },
				{ fullname: "Robert Brown", customer_display_id: "11", created: new Date("2024-12-13T09:15:00") },
				{ fullname: "Lisa Anderson", customer_display_id: "12", created: new Date("2024-12-13T15:30:00") }
			]
		}
	];

	const largeBooksData = [
		{
			isbn: "123",
			title: "The Great Gatsby",
			total: 4,
			customers: [
				{ fullname: "Sarah Johnson", customer_display_id: "1", created: new Date("2024-12-15T10:30:00") },
				{ fullname: "Michael Chen", customer_display_id: "2", created: new Date("2024-12-16T14:20:00") },
				{ fullname: "Emma Davis", customer_display_id: "3", created: new Date("2024-12-14T11:00:00") },
				{ fullname: "John Smith", customer_display_id: "4", created: new Date("2024-12-15T16:45:00") }
			]
		},
		{
			isbn: "321",
			title: "To Kill a Mockingbird",
			total: 2,
			customers: [
				{ fullname: "James Taylor", customer_display_id: "6", created: new Date("2024-12-15T13:00:00") },
				{ fullname: "Margaret White", customer_display_id: "7", created: new Date("2024-12-16T09:20:00") }
			]
		},
		{
			isbn: "456",
			title: "1984",
			total: 3,
			customers: [
				{ fullname: "Jennifer Lee", customer_display_id: "9", created: new Date("2024-12-14T09:00:00") },
				{ fullname: "David Kim", customer_display_id: "13", created: new Date("2024-12-17T14:15:00") },
				{ fullname: "Sophie Martin", customer_display_id: "14", created: new Date("2024-12-18T11:30:00") }
			]
		},
		{
			isbn: "654",
			title: "Brave New World",
			total: 1,
			customers: [{ fullname: "Thomas Green", customer_display_id: "15", created: new Date("2024-12-19T16:00:00") }]
		},
		{
			isbn: "987",
			title: "The Catcher in the Rye",
			total: 2,
			customers: [
				{ fullname: "Rachel Adams", customer_display_id: "16", created: new Date("2024-12-20T10:00:00") },
				{ fullname: "Christopher Lee", customer_display_id: "17", created: new Date("2024-12-20T15:45:00") }
			]
		}
	];
</script>

<Story name="Default (Collapsed)">
	<div class="max-w-3xl">
		<ReconciliationCustomerNotification books={booksData} />
	</div>
</Story>

<Story name="Expanded">
	<div class="max-w-3xl">
		<ReconciliationCustomerNotification books={booksData} expanded={true} />
	</div>
</Story>

<Story name="Single Book">
	<div class="max-w-3xl">
		<ReconciliationCustomerNotification books={singleBookData} expanded={true} />
	</div>
</Story>

<Story name="Empty State">
	<div class="max-w-3xl">
		<ReconciliationCustomerNotification books={[]} />
	</div>
</Story>

<Story name="Non-Interactive (Always Expanded)">
	<div class="max-w-3xl">
		<ReconciliationCustomerNotification books={booksData} expanded={true} interactive={false} />
	</div>
</Story>

<Story name="Large Dataset">
	<div class="max-w-3xl">
		<ReconciliationCustomerNotification books={largeBooksData} expanded={true} />
	</div>
</Story>
