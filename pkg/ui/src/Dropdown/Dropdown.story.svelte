<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { Settings2 } from 'lucide-svelte';

	import { Dropdown } from './index';

	export let Hst: Hst;

	const items = [
		{ label: 'Edit', href: '#edit' },
		{ label: 'Archive', href: '#archive' },
		{ label: 'Move', href: '#move' },
		{ label: 'Share', href: '#share' },
		{ label: 'Add To Favorites', href: '#add-to-favourites' },
		{ label: 'Delete', href: '#delete' }
	];
</script>

<Hst.Story title="Dropdown" layout={{ type: 'grid' }}>
	<Dropdown buttonLabel="Options" {items}>
		<div slot="buttonIcon"><Settings2 /></div>
	</Dropdown>
</Hst.Story>
