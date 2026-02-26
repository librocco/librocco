import { describe, it, expect, vi } from "vitest";
import { get } from "svelte/store";

import type { IAppDbRx } from "$lib/app/rx";

import { reactiveDataSource } from "$lib/utils/reactive-data-source";

describe("reactiveDataSource", () => {
	interface TestData {
		id: string;
		name: string;
	}

	const mockRx = {
		onRange: vi.fn<IAppDbRx["onRange"]>(() => {
			return () => {};
		})
	};

	describe("Initial State without Data", () => {
		it("creates store with ready=false, data={}, error=null when initialized without initialData", () => {
			const dataLoad = vi.fn(async () => ({ id: "1", name: "Test" }));
			const tables = ["test"];

			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);
			const state = get(store);

			expect(state.ready).toBe(false);
			expect(state.data).toEqual({});
			expect(state.error).toBeNull();
		});
	});

	describe("Initial State with Data", () => {
		it("creates store with ready=true, data=initialData, error=null when initialized with initialData", () => {
			const dataLoad = vi.fn(async () => ({ id: "1", name: "Test" }));
			const tables = ["test"];
			const initialData = { id: "1", name: "Initial" };

			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables, initialData);
			const state = get(store);

			expect(state.ready).toBe(true);
			expect(state.data).toEqual(initialData);
			expect(state.error).toBeNull();
		});
	});

	describe("Cold Subscription - First Subscriber", () => {
		it("subscribes to DB changes via rx.onRange() when first subscriber joins cold subscription", () => {
			const dataLoad = vi.fn(async () => ({ id: "1", name: "Test" }));
			const tables = ["test"];

			mockRx.onRange.mockClear();
			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);

			store.subscribe(() => {});

			expect(mockRx.onRange).toHaveBeenCalledTimes(1);
			expect(mockRx.onRange).toHaveBeenCalledWith(tables, expect.any(Function));
		});
	});

	describe("Cold Subscription - Multiple Subscribers", () => {
		it("reuses existing DB subscription when multiple subscribers are present", () => {
			const dataLoad = vi.fn(async () => ({ id: "1", name: "Test" }));
			const tables = ["test"];

			mockRx.onRange.mockClear();
			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);

			const unsubscribe1 = store.subscribe(() => {});
			store.subscribe(() => {});

			expect(mockRx.onRange).toHaveBeenCalledTimes(1);

			unsubscribe1();
		});
	});

	describe("Load on Success", () => {
		it("updates store with loaded data when dataLoad succeeds without initialData", async () => {
			const testData = { id: "1", name: "Test" };
			const dataLoad = vi.fn(async () => testData);
			const tables = ["test"];

			mockRx.onRange.mockClear();
			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);

			const unsubscribe = store.subscribe(() => {});
			const loadCallback = mockRx.onRange.mock.calls[0][1];
			loadCallback([]);

			await expect.poll(() => get(store)).toMatchObject({ ready: true, data: testData, error: null });

			unsubscribe();
		});

		it("updates store with new loaded data when dataLoad succeeds with initialData", async () => {
			const testData = { id: "1", name: "Test" };
			const initialData = { id: "0", name: "Initial" };
			const dataLoad = vi.fn(async () => testData);
			const tables = ["test"];

			mockRx.onRange.mockClear();
			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables, initialData);

			const unsubscribe = store.subscribe(() => {});
			const loadCallback = mockRx.onRange.mock.calls[0][1];
			loadCallback([]);

			await expect.poll(() => get(store)).toMatchObject({ ready: true, data: testData, error: null });

			unsubscribe();
		});
	});

	describe("Load on Error", () => {
		it("stores error when dataLoad fails", async () => {
			const testError = new Error("Test error");
			const dataLoad = vi.fn(async () => {
				throw testError;
			});
			const tables = ["test"];

			mockRx.onRange.mockClear();
			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);

			const unsubscribe = store.subscribe(() => {});
			const loadCallback = mockRx.onRange.mock.calls[0][1];
			loadCallback([]);

			await expect.poll(() => get(store)).toMatchObject({ ready: true, data: {}, error: testError });

			unsubscribe();
		});
	});

	describe("Unsubscribing - Last Subscriber", () => {
		it("clears DB subscription reference when last subscriber unsubscribes", () => {
			const dataLoad = vi.fn(async () => ({ id: "1", name: "Test" }));
			const tables = ["test"];

			let mockDisposerCalled = false;

			mockRx.onRange.mockReturnValue(() => {
				mockDisposerCalled = true;
			});
			mockRx.onRange.mockClear();

			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);

			const unsubscribe = store.subscribe(() => {});
			mockDisposerCalled = false;
			unsubscribe();

			expect(mockDisposerCalled).toBe(false);
		});
	});

	describe("Unsubscribing - Not Last", () => {
		it("keeps DB subscription active when one of multiple subscribers unsubscribes", () => {
			const dataLoad = vi.fn(async () => ({ id: "1", name: "Test" }));
			const tables = ["test"];

			let mockDisposerCalled = false;

			mockRx.onRange.mockReturnValue(() => {
				mockDisposerCalled = true;
			});
			mockRx.onRange.mockClear();

			const store = reactiveDataSource<TestData>(mockRx as any, dataLoad, tables);

			const unsubscribe1 = store.subscribe(() => {});
			const unsubscribe2 = store.subscribe(() => {});
			mockDisposerCalled = false;
			unsubscribe1();

			expect(mockDisposerCalled).toBe(false);

			unsubscribe2();
		});
	});
});
