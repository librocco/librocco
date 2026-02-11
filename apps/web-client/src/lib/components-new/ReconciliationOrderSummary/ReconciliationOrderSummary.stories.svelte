<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import ReconciliationOrderSummary from "./ReconciliationOrderSummary.svelte";

	export const meta: Meta = {
		title: "Reconciliation Order Summary",
		component: ReconciliationOrderSummary
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";
	import { writable } from "svelte/store";
	import UnderdeliveryRadioGroup from "./UnderdeliveryRadioGroup.svelte";
	import UnderdeliveryActionBadge from "./UnderdeliveryActionBadge.svelte";

	const booksData = [
		{ isbn: "123", title: "The Great Gatsby", author: "F. Scott Fitzgerald", ordered: 5, delivered: 1 },
		{ isbn: "321", title: "To Kill a Mockingbird", author: "Harper Lee", ordered: 3, delivered: 0 }
	];

	const allDeliveredData = [
		{ isbn: "123", title: "The Great Gatsby", author: "F. Scott Fitzgerald", ordered: 5, delivered: 5 },
		{ isbn: "321", title: "To Kill a Mockingbird", author: "Harper Lee", ordered: 3, delivered: 3 }
	];

	const singleBookData = [{ isbn: "456", title: "1984", author: "George Orwell", ordered: 4, delivered: 2 }];

	const largeOrderData = [
		{ isbn: "123", title: "The Great Gatsby", author: "F. Scott Fitzgerald", ordered: 5, delivered: 3 },
		{ isbn: "321", title: "To Kill a Mockingbird", author: "Harper Lee", ordered: 3, delivered: 1 },
		{ isbn: "456", title: "1984", author: "George Orwell", ordered: 4, delivered: 2 },
		{ isbn: "789", title: "Pride and Prejudice", author: "Jane Austen", ordered: 2, delivered: 1 },
		{ isbn: "101", title: "Brave New World", author: "Aldous Huxley", ordered: 3, delivered: 1 },
		{ isbn: "202", title: "The Catcher in the Rye", author: "J.D. Salinger", ordered: 6, delivered: 2 }
	];

	const underdeliveryBehaviourStore = writable<"pending" | "queue">("pending");

	// For underdelivery config mismatch warning
	const controlledPendingStore = writable<"pending" | "queue">("pending");
</script>

<Story name="Completed Order">
	<div class="max-w-5xl">
		<ReconciliationOrderSummary orderId="Order #2" customerName="Academic Press" undeliveredCount={0} books={allDeliveredData} />
	</div>
</Story>

<Story name="Large Order (Underdelivery behaviour selection)">
	<div class="max-w-5xl">
		<ReconciliationOrderSummary
			expanded={true}
			orderId="Order #4"
			customerName="University Bookstore"
			undeliveredCount={13}
			books={largeOrderData}
		>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup
					supplierId="sup-001"
					defaultValue="pending"
					on:change={({ detail }) => underdeliveryBehaviourStore.set(detail)}
				/>
			</svelte:fragment>
		</ReconciliationOrderSummary>

		<div class="mt-8 rounded border border-neutral-300 p-2">Underdelivery behaviour: {$underdeliveryBehaviourStore}</div>
	</div>
</Story>

<Story name="Large Order (Finalized)">
	<div class="max-w-5xl">
		<ReconciliationOrderSummary
			expanded={true}
			orderId="Order #4"
			customerName="University Bookstore"
			undeliveredCount={13}
			books={largeOrderData}
		>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryActionBadge value="pending" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
	</div>
</Story>

<Story name="Multiple Orders">
	<div class="max-w-5xl space-y-4">
		<ReconciliationOrderSummary orderId="Order #1" customerName="BooksRUS" undeliveredCount={7} books={booksData}>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup defaultValue="pending" supplierId="sup-001" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
		<ReconciliationOrderSummary orderId="Order #3" customerName="Local Books" undeliveredCount={0} books={allDeliveredData}>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup defaultValue="queue" value={controlledPendingStore} supplierId="sup-003" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
		<ReconciliationOrderSummary orderId="Order #2" customerName="Academic Press" undeliveredCount={6} books={singleBookData}>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup defaultValue="queue" supplierId="sup-002" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
	</div>
</Story>

<Story name="Multiple Orders (Expanded)">
	<div class="max-w-5xl space-y-4">
		<ReconciliationOrderSummary expanded={true} orderId="Order #1" customerName="BooksRUS" undeliveredCount={7} books={booksData}>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup defaultValue="pending" supplierId="sup-001" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
		<ReconciliationOrderSummary expanded={true} orderId="Order #3" customerName="Local Books" undeliveredCount={0} books={allDeliveredData}>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup defaultValue="queue" value={controlledPendingStore} supplierId="sup-003" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
		<ReconciliationOrderSummary
			expanded={true}
			orderId="Order #2"
			customerName="Academic Press"
			undeliveredCount={6}
			books={singleBookData}
		>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryRadioGroup defaultValue="queue" supplierId="sup-002" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
	</div>
</Story>

<Story name="Multiple Orders (Finalized)">
	<div class="max-w-5xl space-y-4">
		<ReconciliationOrderSummary
			expanded={true}
			interactive={false}
			orderId="Order #1"
			customerName="BooksRUS"
			undeliveredCount={7}
			books={booksData}
		>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryActionBadge value="pending" />
			</svelte:fragment>
		</ReconciliationOrderSummary>

		<ReconciliationOrderSummary
			expanded={true}
			interactive={false}
			orderId="Order #2"
			customerName="Academic Press"
			undeliveredCount={6}
			books={singleBookData}
		>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryActionBadge value="queue" />
			</svelte:fragment>
		</ReconciliationOrderSummary>

		<ReconciliationOrderSummary
			expanded={true}
			interactive={false}
			orderId="Order #3"
			customerName="Local Books"
			undeliveredCount={0}
			books={allDeliveredData}
		>
			<svelte:fragment slot="underdelivery_behaviour">
				<UnderdeliveryActionBadge value="pending" />
			</svelte:fragment>
		</ReconciliationOrderSummary>
	</div>
</Story>
