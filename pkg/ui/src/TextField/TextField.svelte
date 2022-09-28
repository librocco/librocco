<script lang="ts">
	let className = '';
	let label: string = 'label';
	let startAdornment: string = '';
	let endAdornment: string = '';
	let placeholder: string = '';
	const onChange: () => void = () => {};
	export { label, startAdornment, endAdornment, placeholder, onChange, className as class };
</script>

<div class={className}>
	<label for="input" class="block text-sm font-medium text-gray-700">
		{label}
	</label>
	<div class="relative mt-1 rounded-md shadow-sm">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			<span class="text-gray-500 sm:text-sm">{startAdornment}</span>
		</div>
		<input
			type="text"
			name="input"
			id="input"
			class="block w-full rounded-md border-gray-500 border-2 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
			{placeholder}
			aria-label="input"
		/>
		<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
			<span class="text-gray-500 sm:text-sm">
				{endAdornment}
			</span>
		</div>
	</div>
</div>
