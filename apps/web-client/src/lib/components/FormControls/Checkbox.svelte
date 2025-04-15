<script lang="ts">
	export let name: string;
	export let id: string;

	export let label = "";
	export let helpText = "";
	export let checked = false;
	export let disabled = false;
</script>

<div class="relative flex max-w-max items-start gap-x-2 p-1">
	<div class="inline-flex items-center">
		<input
			type="checkbox"
			{id}
			{name}
			value={id}
			aria-describedby="{name}-description"
			class="checkbox checkbox-sm"
			bind:checked
			{disabled}
			on:change
		/>
	</div>
	<div>
		<label for={id} class="text-md text-base-content leading-5">
			{label}
		</label>
		<p id="{name}-description" class="text-base-content/80 text-sm">
			{helpText}
		</p>
	</div>
</div>
