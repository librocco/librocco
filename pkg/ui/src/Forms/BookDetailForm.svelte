<script lang="ts">
	import { createForm } from 'felte';

	import { TextField } from '../FormFields';
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

<form class="flex h-auto flex-col gap-y-6" use:form aria-label="Edit book details">
	<div class="flex flex-col justify-between gap-6 p-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<TextField name="isbn" label="ISBN" required />
			</div>
			<div class="basis-full">
				<TextField name="title" label="Title" required />
			</div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 p-4">
		<Button color={ButtonColor.Secondary} on:click={() => onCancel}>Cancel</Button>
		<Button type="submit">Save</Button>
	</div>
</form>
