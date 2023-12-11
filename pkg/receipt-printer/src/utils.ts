export function charLength(char: string) {
	const code = char.charCodeAt(0);
	return code > 0x7f && code <= 0xffff ? 2 : 1; // More than 2bytes count as 2
}

export function textLength(str: string) {
	return str.split("").reduce((accLen, char) => {
		return accLen + charLength(char);
	}, 0);
}

export function textSubstring(str: string, start: number, end?: number) {
	let accLen = 0;
	return str.split("").reduce((accStr, char) => {
		accLen = accLen + charLength(char);
		return accStr + (accLen > start && (!end || accLen <= end) ? char : "");
	}, "");
}

export function upperCase<T extends string>(string: T): Uppercase<T> {
	return string.toUpperCase() as Uppercase<T>;
}

export type AnyCase<T extends string> = Uppercase<T> | Lowercase<T>;
