<script lang="ts">
	import { Search } from "lucide-svelte";
	import { goto } from "$lib/utils/navigation";
	import { Page, ExtensionAvailabilityToast } from "$lib/components";
	import { appPath } from "$lib/paths";
	import type { PageData } from "./$types";
	import { dataChannel } from "$lib/stores/rtc";

	let outOffer = "";
	let inOffer = "";
	let outAnswer = "";
	let inAnswer = "";
	let offererPeerConnection: RTCPeerConnection;
	let answererPeerConnection: RTCPeerConnection;

	// Define ICE servers with Tailscale DNS
	const iceServers = [
		{
			urls: "stun:stun.tailscale.com:3478" // Tailscale STUN server
		}
	];

	// RTCPeerConnection configuration
	const rtcConfig: RTCConfiguration = {
		iceServers: iceServers,
		iceTransportPolicy: "all" // Include all ICE candidates
	};

	const handleCreateOffer = async () => {
		// Initialize RTCPeerConnection with Tailscale configuration
		offererPeerConnection = new RTCPeerConnection(rtcConfig);

		// Create data channel
		const dataChannelInstance = offererPeerConnection.createDataChannel("dataChannel");

		dataChannelInstance.onopen = () => {
			console.log("Data channel is open (Offerer)");
			dataChannel.set(dataChannelInstance);
			goto(appPath("web-rtc/chat"));
		};

		offererPeerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log("Offerer ICE candidate:", event.candidate);
			} else {
				// ICE gathering complete
				outOffer = JSON.stringify(offererPeerConnection.localDescription);
			}
		};

		const offer = await offererPeerConnection.createOffer();
		await offererPeerConnection.setLocalDescription(offer);

		// Wait for ICE gathering to complete
		await new Promise((resolve) => {
			if (offererPeerConnection.iceGatheringState === "complete") {
				resolve(null);
			} else {
				const checkState = () => {
					if (offererPeerConnection.iceGatheringState === "complete") {
						offererPeerConnection.removeEventListener("icegatheringstatechange", checkState);
						resolve(null);
					}
				};
				offererPeerConnection.addEventListener("icegatheringstatechange", checkState);
			}
		});

		// Copy the offer to the clipboard
		await navigator.clipboard.writeText(outOffer);
	};

	const handleAcceptOffer = async () => {
		if (!inOffer) return;

		const remoteOffer = JSON.parse(inOffer);
		// Initialize RTCPeerConnection with Tailscale configuration
		answererPeerConnection = new RTCPeerConnection(rtcConfig);

		answererPeerConnection.ondatachannel = (event) => {
			const dataChannelInstance = event.channel;

			dataChannelInstance.onopen = () => {
				console.log("Data channel is open (Answerer)");
				dataChannel.set(dataChannelInstance);
				goto(appPath("web-rtc/chat"));
			};
		};

		answererPeerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log("Answerer ICE candidate:", event.candidate);
			} else {
				// ICE gathering complete
				outAnswer = JSON.stringify(answererPeerConnection.localDescription);
			}
		};

		await answererPeerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));

		const answer = await answererPeerConnection.createAnswer();
		await answererPeerConnection.setLocalDescription(answer);

		// Wait for ICE gathering to complete
		await new Promise((resolve) => {
			if (answererPeerConnection.iceGatheringState === "complete") {
				resolve(null);
			} else {
				const checkState = () => {
					if (answererPeerConnection.iceGatheringState === "complete") {
						answererPeerConnection.removeEventListener("icegatheringstatechange", checkState);
						resolve(null);
					}
				};
				answererPeerConnection.addEventListener("icegatheringstatechange", checkState);
			}
		});

		// Copy the answer to the clipboard
		await navigator.clipboard.writeText(outAnswer);
	};

	const handleSetRemoteAnswer = async () => {
		if (!inAnswer || !offererPeerConnection) return;

		const remoteAnswer = JSON.parse(inAnswer);
		await offererPeerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));

		// Now the connection should be established
	};

	export let data: PageData;
</script>

<Page view="settings" loaded={true}>
	<svelte:fragment slot="topbar" let:iconProps let:inputProps>
		<Search {...iconProps} />
		<input on:focus={() => goto(appPath("stock"))} placeholder="Search" {...inputProps} />
	</svelte:fragment>

	<svelte:fragment slot="heading">
		<h1 class="text-2xl font-bold leading-7 text-gray-900">Web RTC</h1>
	</svelte:fragment>

	<svelte:fragment slot="main">
		<div class="space-y-12 p-6">
			<!-- Create Offer Section -->
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Connection settings</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Manage connections to services and devices</p>
				</div>
				<div class="w-full basis-2/3">
					<div class="my-4 h-[240px] w-full overflow-hidden rounded border">
						<textarea bind:value={outOffer} disabled class="h-full w-full border-none" />
					</div>
					<div class="flex w-full justify-end">
						<button class="button button-green" on:click={handleCreateOffer}>New offer</button>
					</div>
				</div>
			</div>

			<!-- Accept Offer Section -->
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Accept offer</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Ask a peer for the offer and paste it here to accept the connection.</p>
				</div>
				<div class="w-full basis-2/3">
					<div class="my-4 h-[240px] w-full overflow-hidden rounded border">
						<textarea bind:value={inOffer} class="h-full w-full border-none" />
					</div>
					<div class="flex w-full justify-end">
						<button disabled={!inOffer} class="button button-green" on:click={handleAcceptOffer}>Accept offer</button>
					</div>
				</div>
			</div>

			<!-- Answer Section -->
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Answer</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Copy the answer and send it back to the offerer.</p>
				</div>
				<div class="w-full basis-2/3">
					<div class="my-4 h-[240px] w-full overflow-hidden rounded border">
						<textarea bind:value={outAnswer} disabled class="h-full w-full border-none" />
					</div>
				</div>
			</div>

			<!-- Set Remote Answer Section -->
			<div class="flex flex-col gap-6 px-4 md:flex-row">
				<div class="basis-1/3">
					<h2 class="text-base font-semibold leading-7 text-gray-900">Set Remote Answer</h2>
					<p class="mt-1 text-sm leading-6 text-gray-600">Paste the answer from the answerer to complete the connection.</p>
				</div>
				<div class="w-full basis-2/3">
					<div class="my-4 h-[240px] w-full overflow-hidden rounded border">
						<textarea bind:value={inAnswer} class="h-full w-full border-none" />
					</div>
					<div class="flex w-full justify-end">
						<button disabled={!inAnswer} class="button button-green" on:click={handleSetRemoteAnswer}>Set Remote Answer</button>
					</div>
				</div>
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<ExtensionAvailabilityToast />
	</svelte:fragment>
</Page>
