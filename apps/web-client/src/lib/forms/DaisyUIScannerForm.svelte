<script lang="ts">
	import { defaults } from "sveltekit-superforms";
	import type { FormOptions } from "sveltekit-superforms";
	import { superForm } from "sveltekit-superforms/client";

	import { scannerSchema, type ScannerSchema } from "$lib/forms/schemas";
	import { zod } from "sveltekit-superforms/adapters";
	import { QrCode } from "lucide-svelte";

	export let onSubmit: (isbn: string) => void | Promise<void>;

	let input: HTMLInputElement | undefined = undefined;

	const form = superForm(defaults(zod(scannerSchema)), {
		SPA: true,
		validators: zod(scannerSchema),
		validationMethod: "submit-only",

		onUpdate: async ({ form: { data, valid } }) => {
			// scannerSchema defines isbn minLength as 1, so it will be invalid if "" is entered
			if (valid) {
				await Promise.resolve(onSubmit(data.isbn));
			}
		},
		onUpdated: () => {
			// Why the promise with 0 timeout works, and not tick().then(), nor direct (sync) input.focus() is beyond me,
			// but it was proved to be so (manually testing)...
			setTimeout(() => input.focus(), 0);
		}
	});

	const { form: formStore, enhance } = form;
</script>

<form use:enhance method="POST" class="flex w-full gap-2">
	<label class="input-bordered input flex flex-1 items-center gap-2">
		<QrCode />
		<input
			bind:this={input}
			name="isbn"
			type="text"
			class="grow"
			bind:value={$formStore.isbn}
			placeholder="Enter ISBN of ordered books"
			required
			autocomplete="off"
		/>
	</label>
</form>
