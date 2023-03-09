<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Button, ButtonColor } from '../Button';

	import InventoryTable from './InventoryTable.svelte';
	import { createTable } from '../lib/actions';

	import type { InventoryTableData } from './types';

	export let Hst: Hst;

	const rows: InventoryTableData[] = [
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
		}
	];

	const table = createTable({ rows });
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<div class="flex flex-col gap-y-4">
			<div class="w-24 p-1">
				<Button color={ButtonColor.Primary} on:click={() => table.addRows([rows[0]])}>Add row</Button>
			</div>

			<InventoryTable {table} />
		</div>
	</Hst.Variant>
</Hst.Story>
