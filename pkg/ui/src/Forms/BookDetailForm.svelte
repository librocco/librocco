<script lang="ts">
	import { createForm } from 'felte';

	import { TextField, Checkbox } from '../FormFields';
	import { Button, ButtonColor } from '../Button';

	import type { BookEntry } from './types';

	export let book: BookEntry;
	export let onSubmit: (values: BookEntry) => void = () => {};
	export let onCancel = () => {};

	const { form } = createForm({
		initialValues: book,
		onSubmit
	});
</script>

<form class="divide-y-gray-200 flex h-auto flex-col gap-y-6 divide-y-2" use:form aria-label="Edit book details">
	<div class="flex flex-col justify-between gap-6 p-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<TextField name="isbn" label="ISBN" required />
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
				<TextField name="author" label="Author" />
			</div>
			<div class="basis-full">
				<TextField name="publisher" label="Publisher" />
			</div>
			<div class="basis-full">
				<TextField name="editedBy" label="Edited by" />
			</div>
			<div class="basis-full">
				<Checkbox
					name="outOfPrint"
					label="Out of print"
					helpText="This book is no longer available from the publisher"
				/>
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 p-4">
		<Button color={ButtonColor.Secondary} on:click={() => onCancel}>Cancel</Button>
		<Button type="submit">Save</Button>
	</div>
</form>
