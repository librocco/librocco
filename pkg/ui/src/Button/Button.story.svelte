<script lang="ts">
    import type { Hst } from '@histoire/plugin-svelte'

	import { ButtonSize, ButtonShape, ButtonColor, IconPosition } from './enums';

	import Button from './Button.svelte';
	import { StorybookItem, StorybookGrid } from '../utils/stories';

    export let Hst: Hst

	const buttonText = 'Button Text';
  </script>
  
  <Hst.Story title="Button"> <!-- Typed! -->
    <h1 class="text-lg font-bold mb-4">Square:</h1>
    <StorybookGrid class="mb-16">
		{#each Object.values(ButtonSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Button {...{ size }}>{buttonText}</Button>
			</StorybookItem>
		{/each}
	</StorybookGrid>
  </Hst.Story>