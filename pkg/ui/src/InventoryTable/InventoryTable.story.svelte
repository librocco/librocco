<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import InventoryTable from './InventoryTable.svelte';
	import type { TableData } from './types';
	export let Hst: Hst;

	import { createTable } from './table';

	const rows: TableData[] = [
		{
			isbn: '917289012390',
			title: 'Miti Del Nord',
			authors: 'Neil Gaiman',
			quantity: 3,
			price: 10,
			publisher: 'Mondadori',
			year: '2017',
			editedBy: '',
			outOfPrint: false
		},
		{
			isbn: '917289012381',
			title: 'Hellenistic history and culture',
			authors: 'Peter Green',
			quantity: 3,
			price: 10,
			publisher: 'Penguin',
			year: '2017',
			editedBy: '',
			outOfPrint: false
		},

		{
			isbn: '917289012323',
			title: 'Studies in Greek culture and Roman policy',
			authors: 'Robert Lamberton',
			quantity: 3,
			price: 10,
			publisher: 'Penguin',
			year: '2017',
			editedBy: '',
			outOfPrint: false
		},
		{
			isbn: '917289012371',
			title: 'Miti Del Nord',
			authors: 'Neil Gaiman',
			quantity: 3,
			price: 10,
			publisher: 'Mondadori',
			year: '2017',
			editedBy: '',
			outOfPrint: true
		},
		{
			isbn: '917289012327',
			title: 'Hellenistic history and culture',
			authors: 'Peter Green',
			quantity: 3,
			price: 10,
			publisher: 'Penguin',
			year: '2017',
			editedBy: '',
			outOfPrint: false
		},

		{
			isbn: '917289012188',
			title: 'Studies in Greek culture and Roman policy',
			authors: 'Robert Lamberton',
			quantity: 3,
			price: 10,
			publisher: 'Penguin',
			year: '2017',
			editedBy: '',
			outOfPrint: true
		}
	];

	const table = createTable({ initialRows: rows });
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<InventoryTable {table} />
	</Hst.Variant>
</Hst.Story>
