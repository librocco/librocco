<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { InventoryTableRow, InventoryTable } from './index';
	import type { TableData } from './types';
	export let Hst: Hst;

	const data: TableData[] = [
		{
			isbn: 917289012312,
			title: 'Miti Del Nord',
			author: 'Neil Gaiman',
			editor: '',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},
		{
			isbn: 917289012312,
			title: 'Hellenistic history and culture',
			author: 'Peter Green',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},

		{
			isbn: 917289012310,
			title: 'Studies in Greek culture and Roman policy',
			author: 'Robert Lamberton',
			editor: '',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},
		{
			isbn: 917289012312,
			title: 'Miti Del Nord',
			author: 'Neil Gaiman',
			editor: '',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: true,
			classification: ''
		},
		{
			isbn: 917289012312,
			title: 'Hellenistic history and culture',
			author: 'Peter Green',
			editor: '',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},

		{
			isbn: 917289012310,
			title: 'Studies in Greek culture and Roman policy',
			author: 'Robert Lamberton',
			editor: '',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: true,
			editedBy: ''
		}
	];
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<InventoryTable>
			{#each data as rowData}
				<InventoryTableRow {...rowData} />
			{/each}
		</InventoryTable>
	</Hst.Variant>
</Hst.Story>
