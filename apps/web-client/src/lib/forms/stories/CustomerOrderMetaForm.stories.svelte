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
	import { Story, Template } from "@storybook/addon-svelte-csf";

	import { defaults } from "sveltekit-superforms";

	import { zod } from "sveltekit-superforms/adapters";

	import { customerOrderSchema } from "../schemas";

	const form = defaults(zod(customerOrderSchema));
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
	/>
</Story>
