import getNestedFieldValue from "../getNestedFieldValue";
import type { ISearchIndex } from "./SearchIndex";
type ITfIdfTokenMap = Record<string, ITfIdfTokenMetadata>;
type ITfIdfUidMap = Record<string, ITfIdfUidMetadata>;
type ITfIdfTokenMetadata = {
  $numDocumentOccurrences: number;
  $totalNumOccurrences: number;
  $uidMap: ITfIdfUidMap;
};
type ITfIdfUidMetadata = {
  $document: Record<string, any>;
  $numTokenOccurrences: number;
};

/**
 * Search index capable of returning results matching a set of tokens and ranked according to TF-IDF.
 */
export class TfIdfSearchIndex implements ISearchIndex {
  _uidFieldName: string | Array<string>;
  _tokenToIdfCache: Record<string, number>;
  _tokenMap: ITfIdfTokenMap;

  /**
   * @inheritdoc
   */
  constructor(uidFieldName: string | Array<string>) {
    this._uidFieldName = uidFieldName;
    this._tokenToIdfCache = {};
    this._tokenMap = {};
  }

  /**
   * @inheritDocs
   */
  indexDocument(
    token: string,
    uid: string | number,
    doc: Record<string, any>
  ): void {
    this._tokenToIdfCache = {}; // New index invalidates previous IDF caches

    const tokenMap = this._tokenMap;
    let tokenDatum;

    if (typeof tokenMap[token] !== "object") {
      tokenMap[token] = tokenDatum = {
        $numDocumentOccurrences: 0,
        $totalNumOccurrences: 1,
        $uidMap: {},
      };
    } else {
      tokenDatum = tokenMap[token];
      tokenDatum.$totalNumOccurrences++;
    }

    const uidMap = tokenDatum.$uidMap;

    if (typeof uidMap[uid] !== "object") {
      tokenDatum.$numDocumentOccurrences++;
      uidMap[uid] = {
        $document: doc,
        $numTokenOccurrences: 1,
      };
    } else {
      uidMap[uid].$numTokenOccurrences++;
    }
  }

  /**
   * @inheritDocs
   */
  search(
    tokens: Array<string>,
    corpus: Array<Record<string, any>>
  ): Array<Record<string, any>> {
    const uidToDocumentMap: Record<string, Record<string, any>> = {};

    for (let i = 0, numTokens = tokens.length; i < numTokens; i++) {
      const token = tokens[i];
      const tokenMetadata = this._tokenMap[token];

      // Short circuit if no matches were found for any given token.
      if (!tokenMetadata) {
        return [];
      }

      if (i === 0) {
        const keys = Object.keys(tokenMetadata.$uidMap);

        for (let j = 0, numKeys = keys.length; j < numKeys; j++) {
          const uid = keys[j];
          uidToDocumentMap[uid] = tokenMetadata.$uidMap[uid].$document;
        }
      } else {
        const keys = Object.keys(uidToDocumentMap);

        for (let j = 0, numKeys = keys.length; j < numKeys; j++) {
          const uid = keys[j];

          if (typeof tokenMetadata.$uidMap[uid] !== "object") {
            delete uidToDocumentMap[uid];
          }
        }
      }
    }

    const documents = [];

    for (const uid in uidToDocumentMap) {
      documents.push(uidToDocumentMap[uid]);
    }

    const calculateTfIdf = this._createCalculateTfIdf();

    // Return documents sorted by TF-IDF
    return documents.sort(
      (documentA, documentB) =>
        calculateTfIdf(tokens, documentB, corpus) -
        calculateTfIdf(tokens, documentA, corpus)
    );
  }

  /** */
  _createCalculateIdf(): (...args: Array<any>) => any {
    const tokenMap = this._tokenMap;
    const tokenToIdfCache = this._tokenToIdfCache;
    return function calculateIdf(
      token: string,
      documents: Array<Record<string, any>>
    ): number {
      if (!tokenToIdfCache[token]) {
        const numDocumentsWithToken: number =
          typeof tokenMap[token] !== "undefined"
            ? tokenMap[token].$numDocumentOccurrences
            : 0;
        tokenToIdfCache[token] =
          1 + Math.log(documents.length / (1 + numDocumentsWithToken));
      }

      return tokenToIdfCache[token];
    };
  }

  /** */
  _createCalculateTfIdf(): (...args: Array<any>) => any {
    const tokenMap = this._tokenMap;
    const uidFieldName = this._uidFieldName;

    const calculateIdf = this._createCalculateIdf();

    return function calculateTfIdf(
      tokens: Array<string>,
      document: Record<string, any>,
      documents: Array<Record<string, any>>
    ): number {
      let score = 0;

      for (let i = 0, numTokens = tokens.length; i < numTokens; ++i) {
        const token: string = tokens[i];
        let inverseDocumentFrequency: number = calculateIdf(token, documents);

        if (inverseDocumentFrequency === Infinity) {
          inverseDocumentFrequency = 0;
        }

        let uid: any;

        if (uidFieldName instanceof Array) {
          uid = document && getNestedFieldValue(document, uidFieldName);
        } else {
          uid = document && document[uidFieldName];
        }

        const termFrequency: number =
          typeof tokenMap[token] !== "undefined" &&
          typeof tokenMap[token].$uidMap[uid] !== "undefined"
            ? tokenMap[token].$uidMap[uid].$numTokenOccurrences
            : 0;
        score += termFrequency * inverseDocumentFrequency;
      }

      return score;
    };
  }
}
