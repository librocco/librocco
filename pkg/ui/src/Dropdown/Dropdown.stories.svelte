<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';
	import { StorybookItem, StorybookGrid } from '../utils/stories';

	import { ChevronLeft } from '@librocco/svg';

	import DropdownTrigger from './DropdownTrigger.svelte';
	import DropdownItems from './DropdownItems.svelte';
	import Dropdown from './Dropdown.svelte';
</script>

<Meta title="Components: Dropdown" />

<Story name="Dropdown Trigger">
	<StorybookGrid>
		<StorybookItem>
			<DropdownTrigger label="Options" />
		</StorybookItem>
	</StorybookGrid>
</Story>
<Story name="Dropdown Items">
	<StorybookGrid>
		<StorybookItem>
			<div class="absolute left-64">
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
		</StorybookItem>
	</StorybookGrid>
</Story>
<Story name="Dropdown Menu">
	<StorybookGrid>
		<StorybookItem>
			<div class="absolute left-64">
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
		</StorybookItem>
	</StorybookGrid>
</Story>
