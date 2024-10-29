import { StartStreaming, tags } from "@vlcn.io/ws-common";
import { Transport } from "../transport/Transport.js";
import { DB } from "../DB.js";
import { WLogger, defaultLogger } from "../worker/logger.js";

export default class OutboundStream {
	readonly #db;
	readonly #transport;
	#lastSent: readonly [bigint, number] | null = null;
	#excludeSites: readonly Uint8Array[] = [];
	#localOnly: boolean = false;
	#timeoutHandle: number | null = null;
	#bufferFullBackoff = 50;
	readonly #disposer;

	constructor(db: DB, transport: Transport, private logger: WLogger = defaultLogger) {
		this.#db = db;
		this.#transport = transport;
		this.#disposer = this.#db.onChange(this.#dbChanged);
	}

	startStreaming = async (msg: StartStreaming) => {
		this.#lastSent = msg.since;
		this.#excludeSites = msg.excludeSites;
		this.#localOnly = msg.localOnly;
		// initial kickoff so we don't wait for a db change event
		this.#dbChanged();
	};

	resetStream = async (msg: StartStreaming) => {
		this.startStreaming(msg);
	};

	// TODO: ideally we get throttle information from signals from the rest of the system.
	// Should throttle be here or something that the user would be expected to set up?
	// Ideally we can let them control it so they can make the responsiveness tradeoffs they want.
	#dbChanged = async () => {
		this.logger.log("[worker|outbound_stream|db_changed]", "changed")
		this.logger.log("[worker|outbound_stream|db_changed]", "Checking if lastSent is null");
		if (this.#lastSent == null) {
			this.logger.log("[worker|outbound_stream|db_changed]", "lastSent is null, returning");
			return;
		}
		this.logger.log("[worker|outbound_stream|db_changed]", "Checking if timeoutHandle is not null");
		if (this.#timeoutHandle != null) {
			this.logger.log("[worker|outbound_stream|db_changed]", "Clearing timeoutHandle");
			clearTimeout(this.#timeoutHandle);
			this.#timeoutHandle = null;
		}

		// save off last sent so we can detect a reset that happened while pulling changes.
		const lastSent = this.#lastSent;

		this.logger.log("[worker|outbound_stream|db_changed]", "Pulling changeset from DB");
		const changes = await this.#db.pullChangeset(
			lastSent,
			this.#excludeSites,
			this.#localOnly
		);
		this.logger.log("[worker|outbound_stream|db_changed]", "Checking if lastSent has changed");
		if (lastSent != this.#lastSent) {
			this.logger.log("[worker|outbound_stream|db_changed]", "lastSent has changed, aborting");
			// we got reset. Abort.
			return;
		}

		this.logger.log("[worker|outbound_stream|db_changed]", `Changes pulled: ${changes.length}`);
		if (changes.length == 0) {
			this.logger.log("[worker|outbound_stream|db_changed]", "No changes found, returning");
			return;
		}
		const lastChange = changes[changes.length - 1];
		this.#lastSent = [lastChange[5], 0];

		// console.log(`Sending ${changes.length} changes since ${this.#lastSent}`);

		this.logger.log("[worker|outbound_stream|db_changed]", "Attempting to send changes");
		try {
			const didSend = this.#transport.sendChanges({
				_tag: tags.Changes,
				changes,
				sender: this.#db.siteid,
				since: lastSent,
			});
			this.logger.log("[worker|outbound_stream|db_changed]", `Send result: ${didSend}`);
			switch (didSend) {
				case "sent":
					this.logger.log("[worker|outbound_stream|db_changed]", "Changes sent successfully");
					this.#bufferFullBackoff = 50;
					break;
				case "buffer-full":
					this.logger.log("[worker|outbound_stream|db_changed]", "Buffer full, backing off");
					this.logger.log("[worker|outbound_stream|db_changed]", "Reconnecting, will retry");
					this.#lastSent = lastSent;
					this.#timeoutHandle = setTimeout(
						this.#dbChanged,
						(this.#bufferFullBackoff = Math.max(
							this.#bufferFullBackoff * 2,
							1000
						))
					);
					break;
				case "reconnecting":
					this.#lastSent = lastSent;
					this.#timeoutHandle = setTimeout(this.#dbChanged, 3000);
					break;
			}
		} catch (e) {
			this.logger.log("[worker|outbound_stream|db_changed]", "Error occurred, resetting lastSent");
			this.#lastSent = lastSent;
			throw e;
		}
	};

	// stop listening to the base DB
	stop() {
		this.#disposer();
	}
}
