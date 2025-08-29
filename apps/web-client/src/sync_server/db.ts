import type { IDB, IDBFactory, Config } from "@vlcn.io/ws-server";
import type FSNotify from "@vlcn.io/ws-server/dist/fs/FSNotify";

export class DBFactoryCached implements IDBFactory {
	idbLookup = new Map<string, Promise<IDB>>();

	constructor(private readonly DBFactory: IDBFactory) {
		this.createDB = this.createDB.bind(this);
	}

	createDB: IDBFactory["createDB"] = async (config, fsNotify, room, schemaName, schemaVersion) => {
		const lookupKey = [room, schemaName, schemaVersion].join("---");
		if (this.idbLookup.has(lookupKey)) {
			return this.idbLookup.get(lookupKey)!;
		}

		const promise = this.DBFactory.createDB(config, fsNotify, room, schemaName, schemaVersion);
		this.idbLookup.set(room, promise);
		return promise;
	};
}

export class DBProvider {
	constructor(
		private readonly dbFactory: IDBFactory,
		private readonly config: Config,
		private readonly schemaName: string,
		private readonly schemaVersion: bigint,
		private readonly fsNotify: FSNotify | null = null
	) {}

	async getDB(room: string) {
		const idb = await this.dbFactory.createDB(this.config, this.fsNotify, room, this.schemaName, this.schemaVersion);
		return idb.getDB();
	}
}
