import { Msg } from "./workerMsgTypes.js";
import SyncService from "./SyncService.js";
import { Config } from "../config.js";


export function start(config: Config,) {
	self.postMessage({ log: "Hello from the worker!" })

	const svc = new SyncService(config);
	self.onmessage = (e: MessageEvent<Msg>) => {
		const msg = e.data;

		switch (msg._tag) {
			case "StartSync": {
				svc.startSync(msg);
				break;
			}
			case "StopSync": {
				svc.stopSync(msg);
				break;
			}
		}
	};
}
