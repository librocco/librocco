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
		<label for={id} class="text-md leading-5 text-base-content">
			{label}
		</label>
		<p id="{name}-description" class="text-sm text-base-content/80">
			{helpText}
		</p>
	</div>
</div>
