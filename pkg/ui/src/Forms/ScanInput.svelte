<script lang="ts">
	import { Button, ButtonSize } from "$lib/Button";
	import { TextField, TextFieldSize } from "$lib/FormFields";
	import { createForm } from "felte";
	import { Edit, QrCode } from "lucide-svelte";

	export let onAdd: (isbn: string) => void | Promise<void> = () => {};
	export let onCreate: (isbn: string) => void = () => {};

	const initialValues = { isbn: "" };

	const { form, reset } = createForm({
		initialValues,
		onSubmit: async ({ isbn }, { reset }) => {
			await (async () => onAdd(isbn))();
			reset();
		}
	});

	let isbn = "";

	const handleCreate = async () => {
		await (async () => onCreate(isbn))();
		reset();
	};
</script>

<form id="scan-input-container" use:form>
	<TextField name="isbn" placeholder="Scan to add books..." variant={TextFieldSize.LG} bind:value={isbn}>
		<svelte:fragment slot="startAdornment">
			<QrCode />
		</svelte:fragment>
		<div slot="endAdornment" class="flex gap-x-2">
			<Button type="submit" disabled={isbn === ""}>Add</Button>
			<Button type="button" on:click={handleCreate} size={ButtonSize.SM}>
				<svelte:fragment slot="startAdornment">
					<Edit size={16} />
				</svelte:fragment>
				Create
			</Button>
		</div>
	</TextField>
</form>
