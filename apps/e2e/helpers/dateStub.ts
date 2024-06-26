import { Page } from "@playwright/test";

interface DateStub {
	mock(date: Date | string): Promise<void>;
	reset(): Promise<void>;
}

export async function getDateStub(page: Page): Promise<DateStub> {
	// Save the original date for resets
	const DateProto = await page.evaluateHandle(() => globalThis.Date);

	const mock = async (date: Date | string) => {
		await page.evaluateHandle((date) => {
			const DateProto = Date;
			class MockedDate extends DateProto {
				constructor(...params: any[]) {
					if (params.length === 0) {
						super(date);
					} else {
						// Cast to tuple to appease TS, any number of params is expected
						super(...(params as [any]));
					}
				}

				public static now() {
					return new DateProto(date).getTime();
				}
			}

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			globalThis.Date = MockedDate;
		}, date);
	};

	const reset = async () => {
		await page.evaluateHandle((DateProto) => {
			globalThis.Date = DateProto;
		}, DateProto);
	};

	return { mock, reset };
}
