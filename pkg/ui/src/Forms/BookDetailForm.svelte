<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { createForm } from "felte";
	import { createCombobox } from "svelte-headlessui";
	import { ChevronsUpDown } from "lucide-svelte";

	import { TextField, Checkbox } from "../FormFields";
	import { Button, ButtonColor } from "../Button";
	import { ComboboxMenu } from "../Menus";

	import type { BookEntry } from "./types";

	export let book: Partial<BookEntry> = {};
	export let publisherList: string[] = [];

	const dispatchEvent = createEventDispatcher<{
		submit: BookEntry;
		cancel: void;
		fetch: Partial<BookEntry>;
	}>();

	function handleSubmit(values: BookEntry) {
		dispatchEvent("submit", values);
	}
	function handleCancel() {
		dispatchEvent("cancel");
	}
	function handleFetch() {
		dispatchEvent("fetch", book);
	}

	const initialValues = {
		price: 0
		// The rest of the initial values are "" or 'false' which we don't need to specify
	};
	const { form, setFields } = createForm({
		initialValues: { ...initialValues, ...book },
		onSubmit: (values) => {
			handleSubmit({ ...values, publisher: $publisherCombo.selected || values.publisher });
		}
	});

	// Update fields each time a 'book' changes (this will happen in production, when we account for latency of fetching, possibly, existing book data)
	$: {
		for (const [key, value] of Object.entries(book)) {
			setFields(key as keyof BookEntry, value);
		}
	}

	const publisherCombo = createCombobox({ label: "publisher" });

	let publisher = "";
	$: {
		publisher = $publisherCombo.selected;
	}

	$: publishers = publisherList.filter((p) => p.includes($publisherCombo.filter)).slice(0, 10);
</script>

<form id="book-detail-form" class="divide-y-gray-50 flex h-auto flex-col gap-y-6 divide-y-2" use:form aria-label="Edit book details">
	<div class="flex flex-col justify-between gap-6 p-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div id="isbn-field-container" class="basis-full">
				<TextField name="isbn" label="ISBN" disabled />
			</div>
			<div id="title-field-container" class="basis-full">
				<TextField name="title" label="Title" required />
			</div>
			<div id="price-field-container" class="flex basis-full justify-between gap-x-4">
				<TextField name="price" label="Price" required type="number" step="0.01">
					<span slot="startAdornment">€</span>
				</TextField>
				<TextField name="year" label="Year" />
			</div>
			<div id="authors-field-container" class="basis-full">
				<TextField name="authors" label="Authors" />
			</div>
			<div id="publisher-field-container" class="relative basis-full">
				<TextField name="publisher" autocomplete="off" label="Publisher" inputAction={publisherCombo.input} bind:value={publisher}>
					<div slot="endAdornment">
						<button use:publisherCombo.button type="button" class="flex items-center">
							<ChevronsUpDown class="text-gray-400" />
						</button>
					</div>
				</TextField>
				<ComboboxMenu combobox={publisherCombo} options={publishers} />
			</div>
			<div id="editedBy-field-container" class="basis-full">
				<TextField name="editedBy" label="Edited by" />
			</div>
			<div id="outOfPrint-field-container" class="basis-full">
				<Checkbox name="outOfPrint" label="Out of print" helpText="This book is no longer available from the publisher" />
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<Button color={ButtonColor.White} on:click={handleFetch}>Fetch</Button>
		<Button color={ButtonColor.White} on:click={handleCancel}>Cancel</Button>
		<Button type="submit" color={ButtonColor.Primary}>Save</Button>
	</div>
</form>
