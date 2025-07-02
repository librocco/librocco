<script lang="ts">
	import { superForm } from "sveltekit-superforms/client";
	import QrCode from "$lucide/qr-code";

	import { testId } from "@librocco/shared";

	import type { FormOptions, SuperValidated } from "sveltekit-superforms";
	import type { ScannerSchema } from "$lib/forms/schemas";
	import { LL } from "@librocco/shared/i18n-svelte";

	export let icon = QrCode;
	export let placeholder = "Scan to add books";

	export let data: SuperValidated<ScannerSchema>;
	export let options: FormOptions<ScannerSchema>;

	export let input: HTMLElement | undefined = undefined;

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

<form use:enhance method="POST" id="scan-form" class="h-full w-full">
	<label class="input-bordered input flex flex-1 items-center gap-2">
		<svelte:component this={icon} />
		<input
			name="isbn"
			id="isbn"
			required
			autocomplete="off"
			data-testid={testId("scan-input")}
			bind:this={input}
			bind:value={$formStore.isbn}
			{placeholder}
		/>
	</label>
</form>
