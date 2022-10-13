<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { Settings2 } from 'lucide-svelte';

	import { DropdownTrigger, DropdownItems, Dropdown } from './index';

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
	<Hst.Variant title="Dropdown Trigger">
		<DropdownTrigger label="Options" />
	</Hst.Variant>
	<Hst.Variant title="Dropdown Trigger With Icon">
		<DropdownTrigger label="Options">
			<div slot="icon"><Settings2 /></div>
		</DropdownTrigger>
	</Hst.Variant>
	<Hst.Variant title="Dropdown Items">
		<div class="relative h-80">
			<DropdownItems {items} />
		</div>
	</Hst.Variant>
	<Hst.Variant title="Dropdown Menu">
		<div>
			<Dropdown>
				<DropdownTrigger slot="trigger" label="Options" />
				<DropdownItems slot="items" {items} />
			</Dropdown>
		</div>
	</Hst.Variant>
</Hst.Story>
