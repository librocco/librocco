import { Asserter, DashboardNode, FieldConstructor } from "./types";
import { selector, stringFieldConstructor, testIdSelector } from "./utils";

export interface SearchFieldInterface extends DashboardNode {
	completions(): SearchCompletionsInterface;
}

export function getSearchField(parent: DashboardNode): SearchFieldInterface {
	const container = parent.locator(selector(testIdSelector("search-input")));

	const completions = () => getSearchCompletions(getSearchField(parent));

	return Object.assign(container, { completions, dashboard: parent.dashboard });
}

interface SearchCompletionsInterface extends DashboardNode {
	n(ix: number): SearchCompletionInterface;
	assert(values: Partial<SearchCompletionValues>[]): Promise<void>;
}

function getSearchCompletions(parent: DashboardNode): SearchCompletionsInterface {
	const dashboard = parent.dashboard;
	const container = Object.assign(parent.page().locator(selector(testIdSelector("search-completions-container"))), { dashboard });

	const n = (ix: number) => getCompletion(container, ix);

	const assert = async (values: Partial<SearchCompletionValues>[]) => {
		for (let i = 0; i < values.length; i++) {
			await n(i).assert(values[i]);
		}
		// Last + 1 should not exist
		await n(values.length).waitFor({ state: "detached" });
	};

	return Object.assign(container, { assert, n });
}

interface SearchCompletionValues {
	isbn: string;
	title: string;
	authors: string;
	year: string;
	publisher: string;
}

interface SearchCompletionInterface extends DashboardNode {
	assert(values: Partial<SearchCompletionValues>): Promise<void>;
}

function getCompletion(parent: DashboardNode, ix: number): SearchCompletionInterface {
	const dashboard = parent.dashboard;
	const container = Object.assign(parent.locator(selector(testIdSelector("search-completion"))).nth(ix), { dashboard });

	const field = <K extends SearchCompletionField>(name: K) => completionFieldConstructorLookup[name](container, "" as any);
	const assert = async (values: Partial<SearchCompletionValues>) => {
		await Promise.all(Object.entries(values).map(([k, v]) => field(k as SearchCompletionField).assert(v)));
	};

	return Object.assign(container, { assert });
}

type SearchCompletionField = keyof SearchCompletionValues;
type SearchCompletionFieldLookup = {
	[K in SearchCompletionField]: Asserter<SearchCompletionValues[K]>;
};

const completionFieldConstructorLookup: {
	[K in SearchCompletionField]: FieldConstructor<SearchCompletionFieldLookup, K>;
} = {
	isbn: stringFieldConstructor("isbn"),
	title: stringFieldConstructor("title"),

	// The following fields are all part of meta string, so we can match them by having data-property="meta" element contain the value
	// RegExp is there to allow for loose matching (including the text) for aforementioned reasons
	authors: stringFieldConstructor("meta" as "authors", (w) => new RegExp(w)),
	publisher: stringFieldConstructor("meta" as "publisher", (w) => new RegExp(w)),
	year: stringFieldConstructor("meta" as "year", (w) => new RegExp(w))
};
