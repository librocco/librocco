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

	import { scan } from "$lib/actions/scan";

	export let data: ScannerData | null;
	export let options: ScannerFormOptions;

	const _form = superValidateSync(data, scannerSchema);
	const form = superForm(_form, options);

	const { form: formStore, enhance } = form;
</script>

<form use:enhance method="POST" id="scan-form" class="h-full w-full p-0.5">
	<input
		data-testid={testId("scan-input")}
		name="isbn"
		id="isbn"
		use:scan
		bind:value={$formStore.isbn}
		required
		placeholder="Scan to add books"
		class="h-full w-full border-0 focus:outline-none focus:ring-0"
	/>
</form>
