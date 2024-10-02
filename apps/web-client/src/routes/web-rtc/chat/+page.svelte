<script lang="ts">
	import { onMount } from "svelte";
	import { dataChannel } from "$lib/stores/rtc";
	import { get } from "svelte/store";

	let messages: { sender: "me" | "them"; content: string }[] = [];
	let messageInput = "";
	let channel: RTCDataChannel | null = null;

	onMount(() => {
		channel = get(dataChannel);
		if (channel) {
			channel.onmessage = (event) => {
				messages = [...messages, { sender: "them", content: event.data }];
			};
		} else {
			console.error("No data channel available");
		}
	});

	const sendMessage = () => {
		if (channel && messageInput.trim()) {
			channel.send(messageInput);
			messages = [...messages, { sender: "me", content: messageInput }];
			messageInput = "";
		}
	};
</script>

<div class="chat-container">
	{#each messages as message}
		<div class="message {message.sender}">
			{message.content}
		</div>
	{/each}
</div>
<div class="input-container">
	<input type="text" bind:value={messageInput} placeholder="Type a message" on:keydown={(e) => e.key === "Enter" && sendMessage()} />
	<button on:click={sendMessage}>Send</button>
</div>

<style>
	.chat-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 100px);
		overflow-y: auto;
		padding: 20px;
	}
	.message {
		max-width: 70%;
		padding: 10px;
		border-radius: 10px;
		margin-bottom: 10px;
		word-wrap: break-word;
	}
	.me {
		align-self: flex-end;
		background-color: #dcf8c6;
	}
	.them {
		align-self: flex-start;
		background-color: #fff;
	}
	.input-container {
		display: flex;
		padding: 10px;
		border-top: 1px solid #ccc;
	}
	.input-container input {
		flex: 1;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 5px;
		outline: none;
	}
	.input-container button {
		margin-left: 10px;
		padding: 10px 20px;
		background-color: #4caf50;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
	}
	.input-container button:hover {
		background-color: #45a049;
	}
</style>
