import { Msg } from "./workerMsgTypes.js";
import SyncService from "./SyncService.js";
import { Config } from "../config.js";
import { defaultLogger, WLogger } from "./logger.js";


export function start(config: Config, logger: WLogger = defaultLogger) {
	logger.log("Hello from the worker!")

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
