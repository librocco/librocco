/* eslint-disable @typescript-eslint/no-empty-function */
import { Adapter } from "./adapter";

export class WebUSB extends Adapter<[]> {
	constructor() {
		super();
	}

	open(callback: (error: Error | null) => void = () => {}): this {
		callback(null);
		return this;
	}

	write(data: Uint8Array, callback: (error: Error | null) => void = () => {}): this {
		// classCode: 0 seems to list all USB devices, so it might work for any printer (which is great)
		(navigator as any).usb.requestDevice({ filters: [{ classCode: 0 }] }).then((device: any) =>
			device
				.open()
				.then(() => device.selectConfiguration(1))
				.then(() => device.claimInterface(0))
				.then(() => device.transferOut(1, data))
				.then(() => device.close())
				.then(() => callback(null))
				.catch(callback)
		);
		return this;
	}

	close(callback: (error: Error | null) => void = () => {}): this {
		callback(null);
		return this;
	}

	read(callback: (data: Uint8Array) => void = () => {}): this {
		callback(new Uint8Array([]));
		return this;
	}
}
