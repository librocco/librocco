<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';
	import { SelectMenuContext, SelectMenuTrigger, SelectMenuItems, SelectMenu } from './index';

	export let Hst: Hst;
</script>

<Hst.Story title="SelectMenu" layout={{ type: 'single' }}>
	<Hst.Variant title="Select Menu Trigger">
		<SelectMenuContext initialValue="Different Value">
			<SelectMenuTrigger />
		</SelectMenuContext>
	</Hst.Variant>
	<Hst.Variant title="Select Menu Item">
		<div>
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
	</Hst.Variant>
	<Hst.Variant title="Select Menu">
		<div>
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
	</Hst.Variant>
</Hst.Story>
