<script lang="ts">
	import { Meta, Story, Template } from '@storybook/addon-svelte-csf';

	import { Mail } from '@librocco/svg';

	import { ButtonSize, ButtonShape, ButtonColor, IconPosition } from './enums';

	import Button from './Button.svelte';

	import { StorybookItem, StorybookGrid } from '../utils/stories';

	const buttonText = 'Button Text';
</script>

<Meta title="Components: Button" />

<Story name="Shapes And Sizes">
	<h1 class="text-lg font-bold mb-4">Square:</h1>
	<StorybookGrid class="mb-16">
		{#each Object.values(ButtonSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Button {...{ size }}>{buttonText}</Button>
			</StorybookItem>
		{/each}
	</StorybookGrid>
	<h1 class="text-lg font-bold mb-4">Rounded:</h1>
	<StorybookGrid class="mb-16">
		{#each Object.values(ButtonSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Button shape={ButtonShape.Rounded} {...{ size }}>
					{buttonText}
				</Button>
			</StorybookItem>
		{/each}
	</StorybookGrid>
	<h1 class="text-lg font-bold mb-4">Circular:</h1>
	<StorybookGrid>
		{#each Object.values(ButtonSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Button shape={ButtonShape.Circular} {...{ size }} />
			</StorybookItem>
		{/each}
	</StorybookGrid>
</Story>

<Story name="Icons">
	<h1 class="text-lg font-bold mb-4">Start:</h1>
	<StorybookGrid class="mb-16">
		{#each Object.values(ButtonSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Button class="mb-16" Icon={Mail} {...{ size }}>
					{buttonText}
				</Button>
			</StorybookItem>
		{/each}
	</StorybookGrid>
	<h1 class="text-lg font-bold mb-4">End:</h1>
	<StorybookGrid class="mb-16">
		{#each Object.values(ButtonSize) as size}
			<StorybookItem label={`Size: ${size}`}>
				<Button {...{ size }} class="mb-16" Icon={Mail} iconPosition={IconPosition.End}>
					{buttonText}
				</Button>
			</StorybookItem>
		{/each}
	</StorybookGrid>
</Story>

<!-- The "Colors story" template is used to showcase colors in different states: default, hover, focus -->
<Template id="Colors story">
	<h1 class="text-lg font-bold mb-4">Primary:</h1>
	<StorybookGrid class="mb-16">
		<StorybookItem>
			<Button>{buttonText}</Button>
		</StorybookItem>
		<StorybookItem>
			<Button shape={ButtonShape.Rounded}>{buttonText}</Button>
		</StorybookItem>
		<StorybookItem>
			<Button shape={ButtonShape.Circular} />
		</StorybookItem>
	</StorybookGrid>
	<h1 class="text-lg font-bold mb-4">Secondary:</h1>
	<StorybookGrid class="mb-16">
		<StorybookItem>
			<Button color={ButtonColor.Secondary}>{buttonText}</Button>
		</StorybookItem>
		<StorybookItem>
			<Button color={ButtonColor.Secondary} shape={ButtonShape.Rounded}>
				{buttonText}
			</Button>
		</StorybookItem>
		<StorybookItem>
			<Button color={ButtonColor.Secondary} shape={ButtonShape.Circular} />
		</StorybookItem>
	</StorybookGrid>
	<h1 class="text-lg font-bold mb-4">White:</h1>
	<StorybookGrid class="mb-16">
		<StorybookItem>
			<Button color={ButtonColor.White}>{buttonText}</Button>
		</StorybookItem>
		<StorybookItem>
			<Button color={ButtonColor.White} shape={ButtonShape.Rounded}>
				{buttonText}
			</Button>
		</StorybookItem>
		<StorybookItem>
			<Button color={ButtonColor.White} shape={ButtonShape.Circular} />
		</StorybookItem>
	</StorybookGrid>
</Template>

<Story name="Colors: Default" template="Colors story" />

<Story name="Colors: Hover" template="Colors story" parameters={{ pseudo: { hover: true } }} />

<Story name="Colors: Focus" template="Colors story" parameters={{ pseudo: { focus: true } }} />
