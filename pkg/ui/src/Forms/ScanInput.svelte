<script lang="ts">
	import { Button, ButtonSize } from "$lib/Button";
	import { TextField, TextFieldSize } from "$lib/FormFields";
	import { createForm } from "felte";
	import { QrCode } from "lucide-svelte";

	export let onAdd: (isbn: string) => void | Promise<void> = () => {};

	const initialValues = { isbn: "" };

	const { form } = createForm({
		initialValues,
		onSubmit: async ({ isbn }, { reset }) => {
			await (async () => onAdd(isbn))();
			reset();
		}
	});

	let isbn = "";
</script>

<form id="scan-input-container" use:form>
	<TextField name="isbn" placeholder="Scan to add books..." variant={TextFieldSize.LG} bind:value={isbn}>
		<svelte:fragment slot="startAdornment">
			<QrCode />
		</svelte:fragment>
		<div slot="endAdornment" class="flex gap-x-2">
			<Button type="submit" disabled={isbn === ""}>Add</Button>
		</div>
	</TextField>
</form>
