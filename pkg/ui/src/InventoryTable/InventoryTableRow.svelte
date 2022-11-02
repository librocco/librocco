<script lang="ts">
	export let ISBN = 0;
	export let title = 'N/A';
	export let author = 'N/A';
	export let editor = 'N/A';
	export let quantity = 0;
	export let price = 0;
	export let year = 0;
	export let outOfPrint = false;
	export let editedBy = 'N/A';
	export let classification = 'N/A';
</script>

<tr class="even:bg-gray-50 whitespace-nowrap  text-sm  text-gray-500 ">
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{ISBN}
		</div>
	</td>

	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{title}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{author}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{editor}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{quantity}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{price}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{year}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{outOfPrint}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{editedBy}
		</div>
	</td>
	<td class="first:text-gray-900 first:font-medium py-2 pl-4">
		<div>
			{classification}
		</div>
	</td>
</tr>
