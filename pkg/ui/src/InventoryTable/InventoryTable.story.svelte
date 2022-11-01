<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { InventoryTableRow, InventoryTable } from './index';
	import type { TableData } from './types';
	export let Hst: Hst;

	const data: TableData[] = [
		{
			ISBN: 917289012312,
			title: 'Miti Del Nord',
			author: 'Neil Gaiman',
			editor: 'N/A',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},
		{
			ISBN: 917289012312,
			title: 'Hellenistic history and culture',
			author: 'Peter Green',
			editor: 'N/A',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},

		{
			ISBN: 917289012310,
			title: 'Studies in Greek culture and Roman policy',
			author: 'Robert Lamberton',
			editor: 'N/A',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},
		{
			ISBN: 917289012312,
			title: 'Miti Del Nord',
			author: 'Neil Gaiman',
			editor: 'N/A',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},
		{
			ISBN: 917289012312,
			title: 'Hellenistic history and culture',
			author: 'Peter Green',
			editor: 'N/A',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		},

		{
			ISBN: 917289012310,
			title: 'Studies in Greek culture and Roman policy',
			author: 'Robert Lamberton',
			editor: 'N/A',
			quantity: 3,
			price: 10,
			year: 2017,
			outOfPrint: false,
			editedBy: '',
			classification: ''
		}
	];
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<InventoryTable>
			{#each data as rowData, index}
				<InventoryTableRow className={index % 2 === 0 ? undefined : 'bg-gray-50'} {rowData} />
			{/each}
		</InventoryTable>
	</Hst.Variant>
</Hst.Story>
