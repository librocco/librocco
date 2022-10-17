<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { writable, type Writable } from 'svelte/store';
	import {Table} from './index';
	import type { TableData } from './types';
	export let Hst: Hst;

	const data: Writable<TableData[]> = writable([
		{ ISBN: 917289012312, Titulo: 'Miti Del Nord', Autore: 'Neil Gaiman' },
		{ ISBN: 917289012314, Titulo: 'Hellenistic history and culture', Autore: 'Peter Green' },
		{
			ISBN: 917289012310,
			Titulo: 'Studies in Greek culture and Roman policy',
			Autore: 'Robert Lamberton'
		}
	]);
</script>

<Hst.Story title="Table">
	<Hst.Variant>
		<Table {data} />
	</Hst.Variant>
</Hst.Story>
