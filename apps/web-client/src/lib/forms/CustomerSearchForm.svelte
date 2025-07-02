<script lang="ts">
	import { superForm } from "sveltekit-superforms/client";
	import { Search } from "lucide-svelte";

	import { testId } from "@librocco/shared";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import type { CustomerSearchSchema } from "$lib/forms/schemas";

	export let icon = Search;
	export let placeholder = "Search for a customer by name";

	export let data: SuperValidated<CustomerSearchSchema>;
	export let options: FormOptions<CustomerSearchSchema>;

	export let input: HTMLElement | undefined = undefined;

	const form = superForm(data, options);

	const { form: formStore, enhance } = form;
</script>

<form use:enhance method="POST" class="h-full w-full">
	<label class="input-bordered input flex flex-1 items-center gap-2">
		<svelte:component this={icon} />
		<input
			name="fullname"
			class="w-full"
			id="fullname"
			autocomplete="off"
			data-testid={testId("customer-search-form")}
			bind:this={input}
			bind:value={$formStore.fullname}
			{placeholder}
		/>
	</label>
</form>
