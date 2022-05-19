import { SimpleTokenizer } from "./SimpleTokenizer";
import { StemmingTokenizer } from "./StemmingTokenizer";
describe("StemmingTokenizer", () => {
  const stemmingFunction = (text) => {
    if (text === "cats") {
      return "cat";
    } else {
      return text;
    }
  };
  it("should handle empty values", () => {
    const tokenizer = new StemmingTokenizer(
      stemmingFunction,
      new SimpleTokenizer()
    );
    expect(tokenizer.tokenize("")).toEqual([]);
    expect(tokenizer.tokenize(" ")).toEqual([]);
  });
  it("should convert words to stems", () => {
    const tokenizer = new StemmingTokenizer(
      stemmingFunction,
      new SimpleTokenizer()
    );
    expect(tokenizer.tokenize("the cats")).toEqual(["the", "cat"]);
  });
});
