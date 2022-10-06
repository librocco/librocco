<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';
	import { StorybookItem, StorybookGrid } from '../utils/stories';

	import { ChevronLeft } from '@librocco/svg';

	import DropdownTrigger from './DropdownTrigger.svelte';
	import DropdownItem from './DropdownItem.svelte';
	import DropdownItemCompound from './DropdownItemCompound.svelte';
</script>

<Meta title="Components: Dropdown" />

<Story name="Dropdown Trigger">
	<StorybookGrid>
		<StorybookItem>
			<DropdownTrigger Icon={ChevronLeft} label="Options" />
		</StorybookItem>
	</StorybookGrid>
</Story>
<Story name="Dropdown Items">
	<StorybookGrid>
		<StorybookItem>
			<div class="absolute left-64">
				<DropdownItem items={['Edit', 'Archive', 'Move', 'Share', 'Add To Favorites', 'Delete']} />
			</div>
		</StorybookItem>
	</StorybookGrid>
</Story>
<Story name="Dropdown Compound Items">
	<StorybookItem>
		<div class="absolute left-30">
			<DropdownItemCompound
				items={[
					{
						label: 'Published',
						description: 'This job posting can be viewed by anyone who has the link',
						selected: false
					},
					{
						label: 'Published',
						description: 'This job posting can be viewed by anyone who has the link',
						selected: true
					}
				]}
			/>
		</div>
	</StorybookItem>
</Story>
