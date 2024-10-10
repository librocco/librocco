<script lang="ts">
	import { onMount } from "svelte";
	import initWasm from "@vlcn.io/crsqlite-wasm";
	import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";

	let todos = [];
	let newTodo = "";
	let db: any;

	onMount(async () => {
		const sqlite = await initWasm(() => wasmUrl);
		db = await sqlite.open("todos.sqlite3");
		await db.exec("CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, text TEXT, completed BOOLEAN)");
		const result = await db.exec("SELECT text, completed FROM todos");
		todos = result.map(([text, completed]) => ({ text, completed }));
	});

	async function addTodo() {
		if (newTodo.trim()) {
			await db.exec("INSERT INTO todos (text, completed) VALUES (?, ?)", [newTodo, false]);
			todos = [...todos, { text: newTodo, completed: false }];
			newTodo = "";
		}
	}

	async function removeTodo(index) {
		const todo = todos[index];
		await db.exec("DELETE FROM todos WHERE text = ?", [todo.text]);
		todos = todos.filter((_, i) => i !== index);
	}
</script>

<h1 class="mb-4 px-8 pt-8 text-2xl font-bold">Todo App</h1>

<main class="px-8 py-8">
	<div class="mb-4 flex max-w-[240px]">
		<input
			type="text"
			bind:value={newTodo}
			placeholder="Add a new todo"
			on:keydown={(e) => e.key === "Enter" && addTodo()}
			class="mr-2 flex-grow rounded border p-2"
		/>
		<button on:click={addTodo} class="rounded bg-blue-500 p-2 px-4 text-white">Add</button>
	</div>

	<ul class="max-w-[320px] space-y-2">
		{#each todos as { text }, index}
			<li class="flex items-center justify-between rounded bg-gray-100 p-2 shadow">
				<span class="flex-grow">{text}</span>
				<button on:click={() => removeTodo(index)} class="ml-2 rounded bg-red-500 p-1 px-3 text-white">Remove</button>
			</li>
		{/each}
	</ul>
</main>
