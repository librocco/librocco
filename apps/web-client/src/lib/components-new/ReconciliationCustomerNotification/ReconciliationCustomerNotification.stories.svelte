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
			customers: [
				{ name: "Sarah Johnson", id: "C001", orderDate: "Dec 15, 10:30 AM" },
				{ name: "Michael Chen", id: "C002", orderDate: "Dec 16, 02:20 PM" }
			]
		},
		{
			isbn: "321",
			title: "To Kill a Mockingbird",
			customers: [{ name: "James Taylor", id: "C006", orderDate: "Dec 15, 01:00 PM" }]
		},
		{
			isbn: "456",
			title: "1984",
			customers: [{ name: "Jennifer Lee", id: "C009", orderDate: "Dec 14, 09:00 AM" }]
		}
	];

	const singleBookData = [
		{
			isbn: "789",
			title: "Pride and Prejudice",
			customers: [
				{ name: "Emma Watson", id: "C010", orderDate: "Dec 12, 11:45 PM" },
				{ name: "Robert Brown", id: "C011", orderDate: "Dec 13, 09:15 AM" },
				{ name: "Lisa Anderson", id: "C012", orderDate: "Dec 13, 03:30 PM" }
			]
		}
	];

	const largeBooksData = [
		{
			isbn: "123",
			title: "The Great Gatsby",
			customers: [
				{ name: "Sarah Johnson", id: "C001", orderDate: "Dec 15, 10:30 AM" },
				{ name: "Michael Chen", id: "C002", orderDate: "Dec 16, 02:20 PM" },
				{ name: "Emma Davis", id: "C003", orderDate: "Dec 14, 11:00 AM" },
				{ name: "John Smith", id: "C004", orderDate: "Dec 15, 04:45 PM" }
			]
		},
		{
			isbn: "321",
			title: "To Kill a Mockingbird",
			customers: [
				{ name: "James Taylor", id: "C006", orderDate: "Dec 15, 01:00 PM" },
				{ name: "Margaret White", id: "C007", orderDate: "Dec 16, 09:20 AM" }
			]
		},
		{
			isbn: "456",
			title: "1984",
			customers: [
				{ name: "Jennifer Lee", id: "C009", orderDate: "Dec 14, 09:00 AM" },
				{ name: "David Kim", id: "C013", orderDate: "Dec 17, 02:15 PM" },
				{ name: "Sophie Martin", id: "C014", orderDate: "Dec 18, 11:30 AM" }
			]
		},
		{
			isbn: "654",
			title: "Brave New World",
			customers: [{ name: "Thomas Green", id: "C015", orderDate: "Dec 19, 04:00 PM" }]
		},
		{
			isbn: "987",
			title: "The Catcher in the Rye",
			customers: [
				{ name: "Rachel Adams", id: "C016", orderDate: "Dec 20, 10:00 AM" },
				{ name: "Christopher Lee", id: "C017", orderDate: "Dec 20, 03:45 PM" }
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
