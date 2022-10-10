<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';
	import { StorybookItem, StorybookGrid } from '../utils/stories';

	import SelectMenuTrigger from './SelectMenuTrigger.svelte';
	import SelectMenuItems from './SelectMenuItems.svelte';
	import SelectMenu from './SelectMenu.svelte';
</script>

<Meta title="Components: SelectMenu" />

<Story name="Select Menu Trigger">
	<StorybookGrid>
		<StorybookItem>
			<SelectMenuTrigger label="Options" />
		</StorybookItem>
	</StorybookGrid>
</Story>
<Story name="Select Menu Item">
	<StorybookItem>
		<div class="absolute left-30">
			<SelectMenuItems
				items={[
					{
						label: 'Published',
						description: 'This Note is committed'
					},
					{
						label: 'Draft',
						description: 'This Note is a draft'
					}
				]}
			/>
		</div>
	</StorybookItem>
</Story>
<Story name="Select Menu">
	<StorybookItem>
		<div class="absolute left-30">
			<SelectMenu>
				<SelectMenuTrigger slot="trigger" label="Options" />

				<SelectMenuItems
					selected="Published"
					slot="items"
					items={[
						{
							label: 'Published',
							description: 'This Note is committed'
						},
						{
							label: 'Draft',
							description: 'This Note is a draft'
						}
					]}
				/>
			</SelectMenu>
		</div>
	</StorybookItem>
</Story>
