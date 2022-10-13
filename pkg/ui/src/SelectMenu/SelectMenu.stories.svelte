<script lang="ts">
	import { Meta, Story } from '@storybook/addon-svelte-csf';
	import { StorybookItem, StorybookGrid } from '../utils/stories';
	import { SelectMenuContext, SelectMenuTrigger, SelectMenuItems, SelectMenu } from './index';
</script>

<Meta title="Components: SelectMenu" />

<Story name="Select Menu Trigger">
	<StorybookGrid>
		<StorybookItem>
			<SelectMenuContext initialValue="Different Value">
				<SelectMenuTrigger />
			</SelectMenuContext>
		</StorybookItem>
	</StorybookGrid>
</Story>
<Story name="Select Menu Item">
	<StorybookItem>
		<div class="absolute left-30">
			<SelectMenuContext initialValue="Different Value">
				<SelectMenuItems
					items={[
						{
							label: 'Published',
							description: 'This job posting can be viewed by anyone who has the link'
						},
						{
							label: 'Draft',
							description: 'This job posting can be viewed by anyone who has the link'
						}
					]}
				/>
			</SelectMenuContext>
		</div>
	</StorybookItem>
</Story>
<Story name="Select Menu">
	<StorybookItem>
		<div class="absolute left-30">
			<SelectMenuContext initialValue="Custom Label">
				<SelectMenu>
					<SelectMenuTrigger slot="trigger" />

					<SelectMenuItems
						slot="items"
						items={[
							{
								label: 'Published',
								description: 'This job posting can be viewed by anyone who has the link'
							},
							{
								label: 'Draft',
								description: 'This job posting can be viewed by anyone who has the link'
							}
						]}
					/>
				</SelectMenu>
			</SelectMenuContext>
		</div>
	</StorybookItem>
</Story>
