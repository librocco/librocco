export interface WLogger {
	log: (...params: any[]) => void,
	error: (...params: any[]) => void,
}

export const defaultLogger = {
	log: console.log,
	error: console.error,
}
