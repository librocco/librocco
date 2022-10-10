<script lang="ts">
	import type { Hst } from '@histoire/plugin-svelte';

	import { Mail } from 'lucide-svelte';

	import { ButtonSize, ButtonShape, ButtonColor, IconPosition } from './enums';
	import Button from './Button.svelte';

	export let Hst: Hst;

	const buttonText = 'Button Text';

	let color = ButtonColor.Primary;
</script>

<Hst.Story title="Button" layout={{ type: 'grid' }}>
	<svelte:fragment slot="controls">
		<Hst.Select
			bind:value={color}
			options={[ButtonColor.Primary, ButtonColor.Secondary, ButtonColor.White]}
			title="Color"
		/>
		<pre>{JSON.stringify({ color }, null, 2)}</pre>
	</svelte:fragment>

	<Hst.Variant title="Square">
		{#each Object.values(ButtonSize) as size}
			<div class="py-2">
				<Button {size} {color}>{buttonText}</Button>
			</div>
		{/each}
	</Hst.Variant>

	<Hst.Variant title="Rounded">
		{#each Object.values(ButtonSize) as size}
			<div class="py-2">
				<Button shape={ButtonShape.Rounded} {size} {color}>{buttonText}</Button>
			</div>
		{/each}
	</Hst.Variant>

	<Hst.Variant title="Circular">
		{#each Object.values(ButtonSize) as size}
			<div class="py-2">
				<Button shape={ButtonShape.Circular} {size} {color} />
			</div>
		{/each}
	</Hst.Variant>

	<Hst.Variant title="Icon Start">
		{#each Object.values(ButtonSize) as size}
			<div class="py-2">
				<Button {size} Icon={Mail} {color}>
					{buttonText}
				</Button>
			</div>
		{/each}
	</Hst.Variant>

	<Hst.Variant title="Icon End">
		{#each Object.values(ButtonSize) as size}
			<div class="py-2">
				<Button {size} Icon={Mail} iconPosition={IconPosition.End} {color}>
					{buttonText}
				</Button>
			</div>
		{/each}
	</Hst.Variant>
</Hst.Story>
