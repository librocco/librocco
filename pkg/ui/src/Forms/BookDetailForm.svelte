<script lang="ts">
	import { createForm } from "felte";
	import { createCombobox } from "svelte-headlessui";
	import { ChevronsUpDown } from "lucide-svelte";

	import { TextField, Checkbox } from "../FormFields";
	import { Button, ButtonColor } from "../Button";
	import { ComboboxMenu } from "../Menus";

	import type { BookEntry } from "./types";

	export let book: BookEntry;
	export let publisherList: string[] = [];
	export let onSubmit: (values: BookEntry) => void = () => {};
	export let onCancel = () => {};

	const { form } = createForm({
		initialValues: book,
		onSubmit: (values) => {
			onSubmit(values);
		}
	});

	const publisherCombo = createCombobox({ label: "publisher" });
</script>

<form class="divide-y-gray-50 flex h-auto flex-col gap-y-6 divide-y-2" use:form aria-label="Edit book details">
	<div class="flex flex-col justify-between gap-6 p-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<TextField name="isbn" label="ISBN" required={book.isbn === ""} disabled={book.isbn !== ""} />
			</div>
			<div class="basis-full">
				<TextField name="title" label="Title" required />
			</div>
			<div class="flex basis-full justify-between gap-x-4">
				<TextField name="price" label="Price" required type="number" step="1">
					<span slot="startAdornment">€</span>
				</TextField>
				<TextField name="year" label="Year" />
			</div>
			<div class="basis-full">
				<TextField name="authors" label="Authors" />
			</div>
			<div class="relative basis-full">
				<TextField name="publisher" label="Publisher" inputAction={publisherCombo.input} value={$publisherCombo.selected}>
					<div slot="endAdornment">
						<button use:publisherCombo.button type="button" class="flex items-center">
							<ChevronsUpDown class="text-gray-400" />
						</button>
					</div>
				</TextField>
				<ComboboxMenu combobox={publisherCombo} options={publisherList} />
			</div>
			<div class="basis-full">
				<TextField name="editedBy" label="Edited by" />
			</div>
			<div class="basis-full">
				<Checkbox name="outOfPrint" label="Out of print" helpText="This book is no longer available from the publisher" />
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<Button color={ButtonColor.White} on:click={onCancel}>Cancel</Button>
		<Button type="submit">Save</Button>
	</div>
</form>
