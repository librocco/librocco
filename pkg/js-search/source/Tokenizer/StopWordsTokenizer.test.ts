import { SimpleTokenizer } from "./SimpleTokenizer";
import { StopWordsTokenizer } from "./StopWordsTokenizer";
import { StopWordsMap } from "../StopWordsMap";
describe('StopWordsTokenizer', () => {
  it('should handle empty values', () => {
    const tokenizer = new StopWordsTokenizer(new SimpleTokenizer());
    expect(tokenizer.tokenize('')).toEqual([]);
    expect(tokenizer.tokenize(' ')).toEqual([]);
  });
  it('should not remove tokens that are not stop words', () => {
    const tokenizer = new StopWordsTokenizer(new SimpleTokenizer());
    expect(tokenizer.tokenize('software')).toEqual(['software']);
  });
  it('should remove stop word tokens', () => {
    const tokenizer = new StopWordsTokenizer(new SimpleTokenizer());
    expect(tokenizer.tokenize('and testing')).toEqual(['testing']);
  });
  it('should handle all stop word token sets', () => {
    const tokenizer = new StopWordsTokenizer(new SimpleTokenizer());
    expect(tokenizer.tokenize('a and the')).toEqual([]);
  });
  it('should not remove Object.prototype properties', () => {
    const tokenizer = new StopWordsTokenizer(new SimpleTokenizer());
    expect(tokenizer.tokenize('constructor')).toEqual(['constructor']);
    expect(tokenizer.tokenize('hasOwnProperty')).toEqual(['hasOwnProperty']);
    expect(tokenizer.tokenize('toString')).toEqual(['toString']);
    expect(tokenizer.tokenize('valueOf')).toEqual(['valueOf']);
  });
  it('should allow stop-words to be overridden', () => {
    const tokenizer = new StopWordsTokenizer(new SimpleTokenizer());
    StopWordsMap.the = false;
    expect(tokenizer.tokenize('a and the')).toEqual(['the']);
    StopWordsMap.the = true;
  });
});