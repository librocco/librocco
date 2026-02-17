<script context="module" lang="ts">
	import type { Meta } from "@storybook/svelte";
	import SupplierCard from "./SupplierCard.svelte";

	export const meta: Meta = {
		title: "Supplier Card",
		component: SupplierCard
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	let handleEdit = () => {
		alert("Edit clicked");
	};

	let handleDelete = () => {
		alert("Delete clicked");
	};
</script>

<Story name="Default">
	<div class="w-80">
		<SupplierCard
			name="BooksRUs"
			id="#1"
			email="contact@booksrus.com"
			address="123 Book St, New York, NY"
			orderFormat="N/A"
			on:edit={handleEdit}
			on:delete={handleDelete}
		/>
	</div>
</Story>

<Story name="Minimal Data">
	<div class="w-80">
		<SupplierCard
			name="Minimal Supplier"
			id="#2"
			email=""
			address=""
			orderFormat="Not configured"
			on:edit={handleEdit}
			on:delete={handleDelete}
		/>
	</div>
</Story>

<Story name="Long Content">
	<div class="w-80">
		<SupplierCard
			name="Very Long Supplier Name That Might Overflow The Container"
			id="#SUP-2024-001-BRANCH-AUSTIN-TEXAS-UNITED-STATES"
			email="very.long.email.address@some-booksupplier-company.com.example.net"
			address="1234 Long Street Name, Extended Address Line, City, State, Country, ZIP"
			orderFormat="Available on request via email or call during business hours"
			on:edit={handleEdit}
			on:delete={handleDelete}
		/>
	</div>
</Story>

<Story name="European Supplier">
	<div class="w-80">
		<SupplierCard
			name="Librairie du Marais"
			id="#FR-003"
			email="contact@librairie-marais.fr"
			address="12 Rue des Étoiles, 75004 Paris, France"
			orderFormat="Manual"
			on:edit={handleEdit}
			on:delete={handleDelete}
		/>
	</div>
</Story>
