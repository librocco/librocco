<script lang="ts">
	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import { superForm } from "sveltekit-superforms/client";

	import { testId } from "@librocco/shared";

	import type { ScannerSchema } from "$lib/forms/schemas";

	export let data: SuperValidated<ScannerSchema>;
	export let options: FormOptions<ScannerSchema>;

	let input: HTMLElement | undefined = undefined;

	const form = superForm(data, {
		...options,
		onUpdated: (payload) => {
			// Run the 'onUpdated' function from props first (submitting the scan action)
			//
			// Important: we're not waiting for the 'onUpdated' from props to complete
			// as that causes a delay of 1000+ ms, and firing away in-between still results in the expected state (all scans are captured)
			options.onUpdated(payload);
			// Why the promise with 0 timeout works, and not tick().then(), nor direct (sync) input.focus() is beyond me,
			// but it was proved to be so (manually testing)...
			setTimeout(() => input.focus(), 0);
		}
	});

	const { form: formStore, enhance } = form;
</script>

<form use:enhance method="POST" id="scan-form" class="h-full w-full p-0.5">
	<input
		bind:this={input}
		data-testid={testId("scan-input")}
		name="isbn"
		id="isbn"
		bind:value={$formStore.isbn}
		required
		placeholder="Scan to add books"
		class="h-full w-full border-0 focus:outline-none focus:ring-0"
		autocomplete="off"
	/>
</form>
