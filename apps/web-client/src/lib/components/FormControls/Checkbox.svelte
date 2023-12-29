<script lang="ts">
	export let name: string;
	export let id: string;
	export let label: string;

	export let helpText = "";
	export let checked = false;
	export let disabled = false;

	const labelBaseClasses = ["text-base font-medium", disabled ? "text-gray-400" : "text-gray-800"].join(" ");
	const helpTextClasses = ["text-sm", disabled ? "text-gray-300" : "text-gray-500"].join(" ");
	const inputBaseClasses = [
		"focus:ring-gray-400",
		"h-4",
		"w-4",
		"text-gray-800",
		"border-gray-300",
		"rounded",
		"disabled:text-gray-200"
	].join(" ");
</script>

<div class="relative flex max-w-max items-start gap-x-2 p-1">
	<div class="inline-flex h-5 items-center">
		<input type="checkbox" {id} {name} value={id} aria-describedby={`${name}-description`} class={inputBaseClasses} {checked} {disabled} />
	</div>
	<div>
		<label for={id} class={labelBaseClasses}>
			{label}
		</label>
		<p id={`${name}-description`} class={helpTextClasses}>
			{helpText}
		</p>
	</div>
</div>
