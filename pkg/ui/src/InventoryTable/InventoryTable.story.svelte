<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import InventoryTable from './InventoryTable.svelte';
	import type { TableData } from './types';
	export let Hst: Hst;

	const rows: TableData[] = [
		{
			isbn: '917289012390',
			title: 'Miti Del Nord',
			author: 'Neil Gaiman',
			quantity: 3,
			price: 10,
			year: '2017',
			outOfPrint: false,
			editedBy: ''
		},
		{
			isbn: '917289012381',
			title: 'Hellenistic history and culture',
			author: 'Peter Green',
			quantity: 3,
			price: 10,
			year: '2017',
			outOfPrint: false,
			editedBy: ''
		},

		{
			isbn: '917289012323',
			title: 'Studies in Greek culture and Roman policy',
			author: 'Robert Lamberton',
			quantity: 3,
			price: 10,
			year: '2017',
			outOfPrint: false,
			editedBy: ''
		},
		{
			isbn: '917289012371',
			title: 'Miti Del Nord',
			author: 'Neil Gaiman',
			quantity: 3,
			price: 10,
			year: '2017',
			outOfPrint: true,
			editedBy: ''
		},
		{
			isbn: '917289012327',
			title: 'Hellenistic history and culture',
			author: 'Peter Green',
			quantity: 3,
			price: 10,
			year: '2017',
			outOfPrint: false,
			editedBy: ''
		},

		{
			isbn: '917289012188',
			title: 'Studies in Greek culture and Roman policy',
			author: 'Robert Lamberton',
			quantity: 3,
			price: 10,
			year: '2017',
			outOfPrint: true,
			editedBy: ''
		}
	];
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<InventoryTable {rows} />
	</Hst.Variant>
</Hst.Story>
