import EventEmitter from "events";

export class NotImplementedException extends Error {}

export abstract class Adapter<CloseArgs extends unknown[]> extends EventEmitter {
	abstract open(callback?: (error: Error | null) => void): this;
	abstract write(data: Uint8Array, callback?: (error: Error | null) => void): this;
	abstract close(callback?: (error: Error | null) => void, ...closeArgs: CloseArgs): this;
	abstract read(callback?: (data: Uint8Array) => void): void;
}
