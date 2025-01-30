<script context="module">
	import CustomerOrderMetaForm from "../CustomerOrderMetaForm.svelte";

	export const meta = {
		title: "Forms",
		component: CustomerOrderMetaForm,
		parameters: {
			sveltekit_experimental: {
				forms: {
					enhance: () => {},
					applyAction: () => {}
				},
				stores: {
					page: {}
				}
			}
		}
	};
</script>

<script lang="ts">
	import { Story } from "@storybook/addon-svelte-csf";

	import { defaults } from "sveltekit-superforms";

	import { zod } from "sveltekit-superforms/adapters";

	import { createCustomerOrderSchema } from "../schemas";

	const form = defaults(zod(createCustomerOrderSchema("update")));
</script>

<Story name="Customer Order Meta">
	<CustomerOrderMetaForm
		data={form}
		options={{
			dataType: "json",
			resetForm: true,
			applyAction: false
		}}
		heading="Create a new customer order"
		saveLabel="Update"
		kind="update"
	/>
</Story>
