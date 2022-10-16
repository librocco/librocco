<script lang="ts">
	import SvelteTable from 'svelte-table';
	type value = { id: number; first_name: string; last_name: string; pet: string };
	const rows = [
		{ id: 1, first_name: 'Marilyn', last_name: 'Monroe', pet: 'dog' },
		{ id: 2, first_name: 'Abraham', last_name: 'Lincoln', pet: 'dog' },
		{ id: 3, first_name: 'Mother', last_name: 'Teresa', pet: '' },
		{ id: 4, first_name: 'John F.', last_name: 'Kennedy', pet: 'dog' },
		{ id: 5, first_name: 'Martin Luther', last_name: 'King', pet: 'dog' },
		{ id: 6, first_name: 'Nelson', last_name: 'Mandela', pet: 'cat' },
		{ id: 7, first_name: 'Winston', last_name: 'Churchill', pet: 'cat' },
		{ id: 8, first_name: 'George', last_name: 'Soros', pet: 'bird' },
		{ id: 9, first_name: 'Bill', last_name: 'Gates', pet: 'cat' },
		{ id: 10, first_name: 'Muhammad', last_name: 'Ali', pet: 'dog' },
		{ id: 11, first_name: 'Mahatma', last_name: 'Gandhi', pet: 'bird' },
		{ id: 12, first_name: 'Margaret', last_name: 'Thatcher', pet: 'cat' },
		{ id: 13, first_name: 'Christopher', last_name: 'Columbus', pet: 'dog' },
		{ id: 14, first_name: 'Charles', last_name: 'Darwin', pet: 'dog' },
		{ id: 15, first_name: 'Elvis', last_name: 'Presley', pet: 'dog' },
		{ id: 16, first_name: 'Albert', last_name: 'Einstein', pet: 'dog' },
		{ id: 17, first_name: 'Paul', last_name: 'McCartney', pet: 'cat' },
		{ id: 18, first_name: 'Queen', last_name: 'Victoria', pet: 'dog' },
		{ id: 19, first_name: 'Pope', last_name: 'Francis', pet: 'cat' }
	];
	const columns = [
		{
			key: 'id',
			title: 'ID',
			value: (v: value) => v.id,
			sortable: true,
			filterOptions: (
				rows: { id: number; first_name: string; last_name: string; pet: string }[]
			) => {
				// generate groupings of 0-10, 10-20 etc...
				let nums: { [num: number]: { name: string; value: number } } = {
					0: { name: '0', value: 0 }
				};
				rows.forEach((row) => {
					let num = Math.floor(row.id / 10); // num
					if (nums[num] === undefined)
						// {1}
						nums[num] = { name: `${num * 10} to ${(num + 1) * 10}`, value: num };
				});
				// fix order
				const numsArray = Object.entries(nums)
					.sort()
					.reduce((o, [k, v]) => ((o[Number(k)] = v), o));
				return Object.values(numsArray);
			},
			filterValue: (v: { id: number }) => Math.floor(v.id / 10),
			headerClass: 'text-left'
		},
		{
			//   key: "first_name",
			//   title: "FIRST_NAME",
			//   value: (v:value) => v.first_name,
			//   sortable: true,
			//   filterOptions: (rows: value[]) => {
			//     // use first letter of first_name to generate filter
			//     let letrs = {};
			//     rows.forEach(row => {
			//       let letr = row.first_name.charAt(0);
			//       if (letrs[letr] === undefined)
			//         letrs[letr] = {
			//           name: `${letr.toUpperCase()}`,
			//           value: letr.toLowerCase(),
			//         };
			//     });
			//     // fix order
			//     letrs = Object.entries(letrs)
			//       .sort()
			//       .reduce((o, [k, v]) => ((o[k] = v), o), {});
			//     return Object.values(letrs);
			//   },
			//   filterValue: v => v.first_name.charAt(0).toLowerCase(),
			// },
			// {
			//   key: "last_name",
			//   title: "LAST_NAME",
			//   value: v => v.last_name,
			//   sortable: true,
			//   filterOptions: rows => {
			//     // use first letter of last_name to generate filter
			//     let letrs = {};
			//     rows.forEach(row => {
			//       let letr = row.last_name.charAt(0);
			//       if (letrs[letr] === undefined)
			//         letrs[letr] = {
			//           name: `${letr.toUpperCase()}`,
			//           value: letr.toLowerCase(),
			//         };
			//     });
			//     // fix order
			//     letrs = Object.entries(letrs)
			//       .sort()
			//       .reduce((o, [k, v]) => ((o[k] = v), o), {});
			//     return Object.values(letrs);
			//   },
			//   filterValue: v => v.last_name.charAt(0).toLowerCase(),
			// },
			// {
			//   key: "pet",
			//   title: "Pet",
			//   value: v => v.pet,
			//   renderValue: v => v.pet.charAt(0).toUpperCase() + v.pet.substring(1), // capitalize
			//   sortable: true,
			//   filterOptions: ["bird", "cat", "dog"], // provide array
		}
	];
</script>

<SvelteTable {columns} {rows} />
