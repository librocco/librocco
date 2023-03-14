<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { BookDetailForm } from '../Forms';

	import Slideover from './Slideover.svelte';

	export let Hst: Hst;

	const book = {
		isbn: '',
		title: '',
		authors: '',
		publisher: '',
		year: '',
		price: 0
	};

	const publisherList = ['TCK Publishing', 'Reed Elsevier', 'Penguin Random House', 'Harper Collins', 'Bloomsbury'];
</script>

<Hst.Story title="Slideover" layout={{ type: 'grid', width: 700 }}>
	<Hst.Variant title="Prototype: Create new book">
		<div class="m-4">
			<Slideover
				title="Create a new book"
				supporting="Use this form to manually add a new book to your inbound note"
				handleClose={() => {}}
			>
				<BookDetailForm {book} {publisherList} />
			</Slideover>
		</div>
	</Hst.Variant>
</Hst.Story>
