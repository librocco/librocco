import { SimpleTokenizer } from "./SimpleTokenizer";
import { StemmingTokenizer } from "./StemmingTokenizer";
describe('StemmingTokenizer', function () {
  const stemmingFunction = function (text) {
    if (text === 'cats') {
      return 'cat';
    } else {
      return text;
    }
  };
  it('should handle empty values', function () {
    const tokenizer = new StemmingTokenizer(stemmingFunction, new SimpleTokenizer());
    expect(tokenizer.tokenize('')).toEqual([]);
    expect(tokenizer.tokenize(' ')).toEqual([]);
  });
  it('should convert words to stems', function () {
    const tokenizer = new StemmingTokenizer(stemmingFunction, new SimpleTokenizer());
    expect(tokenizer.tokenize('the cats')).toEqual(['the', 'cat']);
  });
});