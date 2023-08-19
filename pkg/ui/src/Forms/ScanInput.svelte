<script lang="ts">
	import { createForm } from "felte";
	import { QrCode } from "lucide-svelte";

	import { Button } from "$lib/Button";
	import { TextField, TextFieldSize } from "$lib/FormFields";

	export let onAdd: (isbn: string) => void | Promise<void> = () => {};

	const initialValues = { isbn: "" };

	const { form, data } = createForm({
		initialValues,
		onSubmit: async ({ isbn }, { reset }) => {
			await (async () => onAdd(isbn))();
			reset();
		}
	});
</script>

<form id="scan-input-container" use:form>
	<TextField name="isbn" placeholder="Scan to add books..." variant={TextFieldSize.LG}>
		<svelte:fragment slot="startAdornment">
			<QrCode />
		</svelte:fragment>
		<div slot="endAdornment" class="flex gap-x-2">
			<Button type="submit" disabled={!$data.isbn}>Add</Button>
		</div>
	</TextField>
</form>
