<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { Mail } from 'lucide-svelte';
	import { DropdownTrigger, DropdownItems, Dropdown } from './index';

	export let Hst: Hst;
</script>

<Hst.Story title="Dropdown" layout={{ type: 'grid' }}>
	<Hst.Variant title="Dropdown Trigger">
		<DropdownTrigger label="Options" />
	</Hst.Variant>
	<Hst.Variant title="Dropdown Trigger With Icon">
		<DropdownTrigger label="Options">
			<div slot="icon"><Mail /></div>
		</DropdownTrigger>
	</Hst.Variant>
	<Hst.Variant title="Dropdown Items">
		<div>
			<DropdownItems
				items={[
					{ label: 'Edit', href: '' },
					{ label: 'Archive', href: '' },
					{ label: 'Move', href: '' },
					{ label: 'Share', href: '' },
					{ label: 'Add To Favorites', href: '' },
					{ label: 'Delete', href: '' }
				]}
			/>
		</div>
	</Hst.Variant>
	<Hst.Variant title="Dropdown Menu">
		<div>
			<Dropdown>
				<DropdownTrigger slot="trigger" label="Options" />
				<DropdownItems
					slot="items"
					items={[
						{ label: 'Edit', href: '' },
						{ label: 'Archive', href: '' },
						{ label: 'Move', href: '' },
						{ label: 'Share', href: '' },
						{ label: 'Add To Favorites', href: '' },
						{ label: 'Delete', href: '' }
					]}
				/>
			</Dropdown>
		</div>
	</Hst.Variant>
</Hst.Story>
