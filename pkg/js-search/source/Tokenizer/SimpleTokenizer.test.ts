import { SimpleTokenizer } from "./SimpleTokenizer";
describe("SimpleTokenizer", () => {
  it("should convert single-token strings", () => {
    const tokenizer = new SimpleTokenizer();
    expect(tokenizer.tokenize("a")).toEqual(["a"]);
  });
  it("should convert multi-token strings", () => {
    const tokenizer = new SimpleTokenizer();
    expect(tokenizer.tokenize("a b c")).toEqual(["a", "b", "c"]);
  });
  it("should not return empty tokens", () => {
    const tokenizer = new SimpleTokenizer();
    expect(tokenizer.tokenize("  a  ")).toEqual(["a"]);
  });
  it("should remove punctuation", () => {
    const tokenizer = new SimpleTokenizer();
    expect(tokenizer.tokenize("this and, this.")).toEqual([
      "this",
      "and",
      "this"
    ]);
  });
  it("should not remove hyphens", () => {
    const tokenizer = new SimpleTokenizer();
    expect(tokenizer.tokenize("billy-bob")).toEqual(["billy-bob"]);
  });
  it("should not remove apostrophes", () => {
    const tokenizer = new SimpleTokenizer();
    expect(tokenizer.tokenize("it's")).toEqual(["it's"]);
  });
  it("should handle cyrillic", () => {
    const tokenizer = new SimpleTokenizer();
    expect(
      tokenizer.tokenize(
        "Есть хоть одна девушка, которую ты хочешь? Или ты устал от женщин"
      )
    ).toEqual([
      "Есть",
      "хоть",
      "одна",
      "девушка",
      "которую",
      "ты",
      "хочешь",
      "Или",
      "ты",
      "устал",
      "от",
      "женщин"
    ]);
  });
});
