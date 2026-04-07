/**
 * SharedService: leader-elected, multi-tab service sharing via Web Locks + BroadcastChannel.
 *
 * Adapted from rhashimoto/wa-sqlite demo (https://github.com/rhashimoto/wa-sqlite/tree/master/demo/SharedService).
 *
 * One tab wins a Web Lock and becomes the "provider" (leader). It spawns the actual
 * DedicatedWorker that holds the OPFS database. Other tabs get MessagePorts routed
 * to that worker through a tiny SharedWorker relay (which only forwards ports, never
 * touches SQLite). When the leader tab closes, the lock auto-releases and the next
 * queued tab takes over.
 */

import SharedServiceRelay from "./shared-service-relay.worker?sharedworker";

const PROVIDER_REQUEST_TIMEOUT = 3000;

type ProviderChangeCallback = () => void;

/**
 * A SharedService instance coordinates leader election and port distribution
 * for a single named service (e.g. one database).
 */
export class SharedService {
	#serviceName: string;
	#portProviderFunc: () => MessagePort | Promise<MessagePort>;
	#clientId: Promise<string>;

	#clientChannel = new BroadcastChannel("SharedService");
	#onDeactivate: AbortController | null = null;
	#onClose = new AbortController();

	#providerPort: Promise<MessagePort | null>;
	#providerCounter = 0;
	#providerChangeCleanup: (() => void)[] = [];
	#providerChangeListeners = new Set<ProviderChangeCallback>();

	// The relay SharedWorker is shared across all instances (one per origin).
	static #relay: SharedWorker | null = null;
	static #relayReady: Promise<void> | null = null;
	static #relayClientId: string | null = null;

	// Event target for messages forwarded from the relay.
	#relayEvents = new EventTarget();

	constructor(serviceName: string, portProviderFunc: () => MessagePort | Promise<MessagePort>) {
		this.#serviceName = serviceName;
		this.#portProviderFunc = portProviderFunc;
		this.#clientId = this.#getClientId();

		// Connect to current provider and listen for future provider changes.
		this.#providerPort = this.#providerChange();
		this.#clientChannel.addEventListener(
			"message",
			({ data }) => {
				if (data?.type === "provider" && data?.sharedService === this.#serviceName) {
					this.#closeProviderPort(this.#providerPort);
					this.#providerPort = this.#providerChange();
					for (const cb of this.#providerChangeListeners) {
						try {
							cb();
						} catch {
							// best-effort
						}
					}
				}
			},
			{ signal: this.#onClose.signal }
		);
	}

	/** Register a callback for when the provider (leader) changes. */
	onProviderChange(cb: ProviderChangeCallback): () => void {
		this.#providerChangeListeners.add(cb);
		return () => this.#providerChangeListeners.delete(cb);
	}

	/** Participate in leader election. Call once per tab. */
	activate(): void {
		if (this.#onDeactivate) return;
		this.#onDeactivate = new AbortController();

		navigator.locks
			.request(`SharedService-${this.#serviceName}`, { signal: this.#onDeactivate.signal }, async () => {
				// We won the lock — we are the provider (leader).
				const port = await this.#portProviderFunc();
				port.start();

				const providerId = await this.#clientId;
				const providerChannel = new BroadcastChannel("SharedService");

				// Serialize port-broker request/response pairs. Without this, concurrent
				// requests cause multiple `{ once: true }` listeners to fire on the same
				// broker response message, misrouting ports.
				let requestQueue = Promise.resolve();

				providerChannel.addEventListener(
					"message",
					({ data }) => {
						if (data?.type === "request" && data?.sharedService === this.#serviceName) {
							requestQueue = requestQueue.then(async () => {
								const requestedPort = await new Promise<MessagePort>((resolve) => {
									port.addEventListener(
										"message",
										(event) => {
											resolve(event.ports[0]);
										},
										{ once: true }
									);
									port.postMessage(data.clientId);
								});

								this.#sendPortToClient(data, requestedPort);
							});
						}
					},
					{ signal: this.#onDeactivate!.signal }
				);

				// Announce ourselves as the new provider.
				providerChannel.postMessage({
					type: "provider",
					sharedService: this.#serviceName,
					providerId
				});

				// Hold the lock until deactivated or tab closes.
				return new Promise<void>((_, reject) => {
					this.#onDeactivate!.signal.addEventListener("abort", () => {
						providerChannel.close();
						reject(this.#onDeactivate!.signal.reason);
					});
				});
			})
			.catch((err) => {
				// AbortError from deactivate() is expected lifecycle — nothing to do.
				// Other errors (e.g. portProviderFunc OPFS failures) mean this tab
				// cannot be the provider. Bump the counter so any in-progress
				// #providerChange loop exits with null, causing getPort() to throw
				// and trigger the DedicatedWorker fallback in worker-db.ts.
				if (err?.name !== "AbortError") {
					this.#providerCounter++;
				}
			});
	}

	deactivate(): void {
		this.#onDeactivate?.abort();
		this.#onDeactivate = null;
	}

	close(): void {
		this.deactivate();
		this.#onClose.abort();
	}

	/** Get a MessagePort connected to the provider's service. */
	async getPort(): Promise<MessagePort> {
		let port = await this.#providerPort;
		if (!port) {
			// A provider change may have occurred while we were waiting (e.g. this
			// tab became the leader and announced itself). #providerPort was
			// reassigned by the provider-change listener — await the latest promise.
			port = await this.#providerPort;
		}
		if (!port) {
			throw new Error(`SharedService(${this.#serviceName}): no provider available`);
		}
		return port;
	}

	// --- Private helpers ---

	#sendPortToClient(message: any, port: MessagePort): void {
		const relay = SharedService.#relay;
		if (!relay) throw new Error("SharedService relay not initialized");
		relay.port.postMessage(message, [port]);
	}

	async #getClientId(): Promise<string> {
		// Use a Web Lock to discover our clientId.
		const nonce = Math.random().toString();
		const clientId = await navigator.locks.request(nonce, async () => {
			const { held } = await navigator.locks.query();
			return held!.find((lock) => lock.name === nonce)?.clientId ?? "";
		});

		// Acquire a persistent lock named after our clientId so other contexts
		// can track our lifetime.
		await SharedService.#acquireContextLock(clientId);

		// Set up the relay SharedWorker (once per origin).
		await SharedService.#initRelay(clientId);

		// Listen for messages forwarded from the relay to this instance.
		SharedService.#relay!.port.addEventListener("message", (event: MessageEvent) => {
			const data = { ...event.data, ports: (event as MessageEvent).ports };
			this.#relayEvents.dispatchEvent(new MessageEvent("message", { data }));
		});

		return clientId;
	}

	async #providerChange(): Promise<MessagePort | null> {
		const providerCounter = ++this.#providerCounter;
		let providerPort: MessagePort | undefined;
		const clientId = await this.#clientId;

		while (!providerPort && providerCounter === this.#providerCounter) {
			const nonce = randomString();
			this.#clientChannel.postMessage({
				type: "request",
				nonce,
				sharedService: this.#serviceName,
				clientId
			});

			const providerPortReady = new Promise<MessagePort | undefined>((resolve) => {
				const abortController = new AbortController();
				this.#relayEvents.addEventListener(
					"message",
					((event: MessageEvent) => {
						if (event.data?.nonce === nonce) {
							resolve(event.data.ports?.[0]);
							abortController.abort();
						}
					}) as EventListener,
					{ signal: abortController.signal }
				);
				this.#providerChangeCleanup.push(() => abortController.abort());
			});

			providerPort = await Promise.race([
				providerPortReady,
				new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), PROVIDER_REQUEST_TIMEOUT))
			]);

			if (!providerPort) {
				providerPortReady.then((port) => port?.close());
			}
		}

		if (providerPort && providerCounter === this.#providerCounter) {
			this.#providerChangeCleanup.forEach((f) => f());
			this.#providerChangeCleanup = [];
			providerPort.start();
			return providerPort;
		} else {
			providerPort?.close();
			return null;
		}
	}

	#closeProviderPort(providerPort: Promise<MessagePort | null>): void {
		providerPort.then((port) => port?.close());
	}

	// Acquire one context lock per tab (shared across all SharedService instances).
	static #contextLockAcquired = false;
	static async #acquireContextLock(clientId: string): Promise<void> {
		if (SharedService.#contextLockAcquired) return;
		SharedService.#contextLockAcquired = true;
		return new Promise<void>((resolve) => {
			navigator.locks.request(clientId, () => {
				resolve();
				// Hold indefinitely — released when tab closes.
				return new Promise<void>(() => {});
			});
		});
	}

	static async #initRelay(clientId: string): Promise<void> {
		if (SharedService.#relayReady) return SharedService.#relayReady;
		SharedService.#relayReady = (async () => {
			SharedService.#relay = new SharedServiceRelay();
			SharedService.#relay.port.start();
			SharedService.#relay.port.postMessage({ clientId });
			SharedService.#relayClientId = clientId;
			// Wait for the relay to acknowledge registration before proceeding.
			// Without this, a provider tab could try to forward a port to us
			// before the relay has registered our clientId, silently dropping it.
			await new Promise<void>((resolve) => {
				const listener = (e: MessageEvent) => {
					if (e.data?._type === "relay-registered") {
						SharedService.#relay!.port.removeEventListener("message", listener);
						resolve();
					}
				};
				SharedService.#relay!.port.addEventListener("message", listener);
			});
		})();
		return SharedService.#relayReady;
	}
}

/**
 * Create a port that handles incoming client connection requests and creates
 * per-client MessageChannels. Used by the leader tab to bridge client tabs
 * to the DedicatedWorker.
 *
 * For each incoming client request (a postMessage with clientId), this creates
 * a new MessageChannel: port1 is sent back (to be forwarded to the client via
 * the relay), port2 is passed to `onClientPort` for the caller to wire up
 * (e.g. transfer to the DedicatedWorker).
 */
export function createPortBroker(onClientPort: (port: MessagePort, clientId: string) => void): MessagePort {
	const { port1: brokerPort, port2: returnPort } = new MessageChannel();

	brokerPort.addEventListener("message", ({ data: clientId }) => {
		const { port1, port2 } = new MessageChannel();

		// When the client tab dies, its context lock releases. Use a shared lock
		// request to detect this and clean up.
		navigator.locks.request(clientId, { mode: "shared" }, () => {
			port1.close();
		});

		// port1 stays here (forwarded to the client via relay), port2 goes to the worker.
		onClientPort(port2, clientId);
		brokerPort.postMessage(null, [port1]);
	});
	brokerPort.start();

	return returnPort;
}

function randomString(): string {
	return Math.random().toString(36).replace("0.", "");
}
