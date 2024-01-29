import type { ISearchIndex } from "./SearchIndex";

/**
 * Search index capable of returning results matching a set of tokens but without any meaningful rank or order.
 */
export class UnorderedSearchIndex implements ISearchIndex {
	_tokenToUidToDocumentMap: Record<string, Record<string, any>>;

	/**
	 * @inheritdoc
	 */
	constructor() {
		this._tokenToUidToDocumentMap = {};
	}

	/**
	 * @inheritDocs
	 */
	indexDocument(token: string, uid: string, doc: Record<string, any>): void {
		if (typeof this._tokenToUidToDocumentMap[token] !== "object") {
			this._tokenToUidToDocumentMap[token] = {};
		}

		this._tokenToUidToDocumentMap[token][uid] = doc;
	}

	/**
	 * @inheritDocs
	 */
	search(tokens: Array<string>): Array<Record<string, any>> {
		const intersectingDocumentMap: Record<string, any> = {};
		const tokenToUidToDocumentMap = this._tokenToUidToDocumentMap;

		for (let i = 0, numTokens = tokens.length; i < numTokens; i++) {
			const token = tokens[i];
			const documentMap = tokenToUidToDocumentMap[token];

			// Short circuit if no matches were found for any given token.
			if (!documentMap) {
				return [];
			}

			if (i === 0) {
				const keys = Object.keys(documentMap);

				for (let j = 0, numKeys = keys.length; j < numKeys; j++) {
					const uid = keys[j];
					intersectingDocumentMap[uid] = documentMap[uid];
				}
			} else {
				const keys = Object.keys(intersectingDocumentMap);

				for (let j = 0, numKeys = keys.length; j < numKeys; j++) {
					const uid = keys[j];

					if (typeof documentMap[uid] !== "object") {
						delete intersectingDocumentMap[uid];
					}
				}
			}
		}

		const keys = Object.keys(intersectingDocumentMap);
		const documents = [];

		for (let i = 0, numKeys = keys.length; i < numKeys; i++) {
			const uid = keys[i];
			documents.push(intersectingDocumentMap[uid]);
		}

		return documents;
	}
}
