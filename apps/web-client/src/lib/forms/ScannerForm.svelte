<script lang="ts" context="module">
	import type { SuperForm } from "sveltekit-superforms/client";

	type ScannerForm = SuperForm<ZodValidation<typeof scannerSchema>, unknown>;
	export type ScannerFormOptions = ScannerForm["options"];
</script>

<script lang="ts">
	import type { ZodValidation } from "sveltekit-superforms";
	import { superForm, superValidateSync } from "sveltekit-superforms/client";

	import { testId } from "@librocco/shared";

	import { scannerSchema, type ScannerData } from "$lib/forms/schemas";

	export let data: ScannerData | null;
	export let options: ScannerFormOptions;

	let input: HTMLElement | undefined = undefined;

	const _form = superValidateSync(data, scannerSchema);
	const form = superForm(_form, {
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
