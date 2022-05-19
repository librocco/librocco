import type { IIndexStrategy } from "./IndexStrategy";

/**
 * Indexes for all substring searches (e.g. the term "cat" is indexed as "c", "ca", "cat", "a", "at", and "t").
 */
export class AllSubstringsIndexStrategy implements IIndexStrategy {
  /**
   * @inheritDocs
   */
  expandToken(token: string): Array<string> {
    const expandedTokens = [];
    let string;

    for (let i = 0, length = token.length; i < length; ++i) {
      string = "";

      for (let j = i; j < length; ++j) {
        string += token.charAt(j);
        expandedTokens.push(string);
      }
    }

    return expandedTokens;
  }
}
