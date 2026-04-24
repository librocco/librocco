/**
 * Tiny SharedWorker that forwards MessagePorts between tabs.
 *
 * Each tab registers with its clientId. When the provider (leader) needs to send
 * a MessagePort to a client tab, it sends the port here, and this worker forwards
 * it to the correct tab based on clientId.
 *
 * This worker never touches SQLite — it's pure port routing.
 */

const clients = new Map<string, MessagePort>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scope = self as any;
scope.addEventListener("connect", (event: MessageEvent) => {
	const workerPort = (event as MessageEvent).ports[0];

	workerPort.addEventListener(
		"message",
		(event: MessageEvent) => {
			const clientId = event.data.clientId;
			clients.set(clientId, workerPort);

			// Acknowledge registration so the client knows it can safely request ports.
			workerPort.postMessage({ _type: "relay-registered" });

			// When the client tab dies, its context lock releases. Detect this
			// and clean up the entry.
			navigator.locks.request(clientId, { mode: "shared" }, () => {
				clients.get(clientId)?.close();
				clients.delete(clientId);
			});

			// All subsequent messages are forwarded to the target client.
			workerPort.addEventListener("message", (event: MessageEvent) => {
				const target = clients.get(event.data.clientId);
				if (target) {
					target.postMessage(event.data, event.ports as unknown as Transferable[]);
				}
			});
		},
		{ once: true }
	);

	workerPort.start();
});
