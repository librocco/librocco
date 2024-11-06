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

	import { customerOrderMetaSchema } from "../CustomerOrderMetaForm.svelte";

	const form = defaults(zod(customerOrderMetaSchema));
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
