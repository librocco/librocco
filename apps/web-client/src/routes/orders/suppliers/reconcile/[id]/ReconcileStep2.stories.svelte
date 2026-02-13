<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import ReconcileStep2 from "./ReconcileStep2.svelte";

	export const meta: Meta = {
		title: "ReconcileStep2",
		component: ReconcileStep2
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";
	import type { PageData } from "./$types";

	const mockData: Partial<PageData> = {
		reconciliationOrder: {
			id: 1,
			supplierOrderIds: [1, 2],
			receivedAt: new Date()
		} as any,
		placedOrderLines: [
			{
				id: 1,
				supplierOrderId: 1,
				isbn: "123",
				title: "The Great Gatsby",
				quantity: 7,
				price: 12.99,
				supplier_id: 1,
				supplier_name: "BooksRUS"
			} as any,
			{
				id: 2,
				supplierOrderId: 1,
				isbn: "321",
				title: "To Kill a Mockingbird",
				quantity: 3,
				price: 14.99,
				supplier_id: 1,
				supplier_name: "BooksRUS"
			} as any,
			{
				id: 3,
				supplierOrderId: 2,
				isbn: "456",
				title: "1984",
				quantity: 4,
				price: 10.99,
				supplier_id: 2,
				supplier_name: "Academic Press"
			} as any
		],
		reconciliationOrderLines: [
			{ id: 1, reconciliationOrderId: 1, isbn: "123", quantity: 4 } as any,
			{ id: 2, reconciliationOrderId: 1, isbn: "321", quantity: 2 } as any,
			{ id: 3, reconciliationOrderId: 1, isbn: "456", quantity: 4 } as any
		],
		customerOrderLines: [
			{
				id: 1,
				isbn: "123",
				quantity: 2,
				customer_fullname: "John Smith",
				customer_id: 1,
				status: 0,
				created: new Date("2024-12-15T10:30:00")
			} as any,
			{
				id: 2,
				isbn: "123",
				quantity: 2,
				customer_fullname: "Emily Davis",
				customer_id: 2,
				status: 0,
				created: new Date("2024-12-16T14:20:00")
			} as any,
			{
				id: 3,
				isbn: "321",
				quantity: 2,
				customer_fullname: "Michael Brown",
				customer_id: 3,
				status: 0,
				created: new Date("2024-12-15T13:00:00")
			} as any,
			{
				id: 4,
				isbn: "456",
				quantity: 4,
				customer_fullname: "Sarah Wilson",
				customer_id: 4,
				status: 0,
				created: new Date("2024-12-14T09:00:00")
			} as any
		],
		plugins: {} as any
	};
</script>

<Story name="Default (Interactive)">
	<div class="h-[800px]">
		<ReconcileStep2
			data={mockData as PageData}
			finalized={false}
			onBack={() => {
				console.log("Back clicked");
			}}
			onFinalize={() => {
				console.log("Finalize clicked");
			}}
		/>
	</div>
</Story>

<Story name="Finalized (View-Only)">
	<div class="h-[800px]">
		<ReconcileStep2
			data={mockData as PageData}
			finalized={true}
			onBack={() => {
				console.log("Back clicked");
			}}
			onFinalize={() => {
				console.log("Finalize clicked");
			}}
		/>
	</div>
</Story>
