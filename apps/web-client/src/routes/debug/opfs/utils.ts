export class Logger {
	private _logLevel = 0;

	prefix: string;

	constructor(
		prefix: string = "",
		private readonly parent: Logger = null
	) {
		this.prefix = [this.parent?.prefix, prefix && `[${prefix}]`].filter(Boolean).join("");
	}

	logLevel() {
		return this.parent?.logLevel() ?? this._logLevel;
	}

	setLogLevel(level: number) {
		if (this.parent) {
			this.parent.setLogLevel(level);
			return;
		}

		this._logLevel = level;
	}

	log(...args: any[]) {
		if (this.logLevel() > 0) {
			const prefix = ["[log]", this.prefix].filter(Boolean).join("");
			console.log(prefix, ...args);
		}
	}

	debug(...args: any[]) {
		if (this.logLevel() > 1) {
			const prefix = ["[debug]", this.prefix].filter(Boolean).join("");
			console.log(prefix, ...args);
		}
	}

	error(...args: any[]) {
		const prefix = ["[error]", this.prefix].filter(Boolean).join("");
		console.error(prefix, ...args);
	}

	extend(prefix: string) {
		return new Logger(prefix, this);
	}
}
