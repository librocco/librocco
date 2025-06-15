import { Tag, type WkrMsg } from "./types";

import type { VFSKind } from "./db";
import { Logger } from "./utils";

const randId = () => Date.now() + Math.floor(Math.random() * 1000);

class Comm {
	#reqListeners = new Map<number, (msg: WkrMsg<Tag>) => void>();
	#errListeners = new Map<number, (message: string) => void>();

	constructor(
		private readonly worker: Worker,
		private readonly dbid: string,
		private readonly logger = new Logger()
	) {
		this.logger.debug("Comm constructor -- initialised", { worker, dbid });
		this.worker.addEventListener("message", this._handleMessage.bind(this));
	}

	private _postMessage<T extends Tag>(id: number, tag: T, body: any = null): WkrMsg<T> {
		const msg: WkrMsg<T> = {
			_id: id,
			_tag: tag,
			_dbid: this.dbid,
			reqBody: body
		};

		this.logger.debug("posting message", { id, tag, body });
		this.worker.postMessage(msg);

		return msg;
	}

	private _handleMessage(e: MessageEvent<WkrMsg<Tag>>) {
		this.logger.debug("got message", e.data);

		this.logger.debug("req listeners", this.#reqListeners);
		this.logger.debug("err listeners", this.#errListeners);

		if (!this.#reqListeners.has(e.data?._id)) return;

		if (e.data!.status === "ok") this.#reqListeners.get(e.data!._id)(e.data.resBody);
		if (e.data!.status === "error") this.#errListeners.get(e.data!._id)(e.data.resBody.error);

		this.#reqListeners.delete(e.data._id);
		this.#errListeners.delete(e.data._id);
	}

	request<T extends Tag>(tag: T, body: any = null): Promise<WkrMsg<T>["resBody"]> {
		const id = randId();

		this.logger.debug("sending request", { id, tag, body });

		return new Promise<any>((resolve, reject) => {
			this.#reqListeners.set(id, resolve);
			this.#errListeners.set(id, reject);

			this._postMessage(id, tag, body);
		});
	}
}

class WorkerDB {
	constructor(
		private readonly wdi: WorkerDBInterface,
		private readonly comm: Comm,
		private readonly dbid: string,
		private readonly logger = new Logger()
	) {}

	async exec<R extends any[] | undefined>(sql: string, bind: SQLiteCompatibleType[] = null): Promise<R extends any[] ? R[] : void> {
		const res = await this.comm.request(Tag.EXEC, { sql, bind });
		return res as R extends any[] ? R[] : void;
	}
}

export class WorkerDBInterface {
	#logger = new Logger();

	constructor(
		private readonly worker: Worker,
		private readonly wasmUrl: string
	) {
		this.#logger.debug("constructor -- initialised");
	}

	async open(dbid: string, vfs: VFSKind): Promise<WorkerDB> {
		this.#logger.log("open", { dbid, vfs });

		const comm = new Comm(this.worker, dbid, this.#logger.extend("comm"));

		this.#logger.debug("requesting database open");
		await comm.request(Tag.OPEN, { wasmUrl: this.wasmUrl, vfs });
		this.#logger.debug("database open request completed!");

		return new WorkerDB(this, comm, dbid, this.#logger.extend("worker db interface"));
	}

	setLogLevel(level: number) {
		this.#logger.setLogLevel(level);
	}
}
