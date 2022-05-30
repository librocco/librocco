import { AllSubstringsIndexStrategy } from "./AllSubstringsIndexStrategy";
describe("AllSubstringsIndexStrategy", () => {
  let indexStrategy: AllSubstringsIndexStrategy;
  beforeEach(() => {
    indexStrategy = new AllSubstringsIndexStrategy();
  });
  it("should not expand empty tokens", () => {
    const expandedTokens = indexStrategy.expandToken("");
    expect(expandedTokens.length).toEqual(0);
  });
  it("should not expand single character tokens", () => {
    const expandedTokens = indexStrategy.expandToken("a");
    expect(expandedTokens.length).toEqual(1);
    expect(expandedTokens).toContain("a");
  });
  it("should expand multi-character tokens", () => {
    const expandedTokens = indexStrategy.expandToken("cat");
    expect(expandedTokens.length).toEqual(6);
    expect(expandedTokens).toContain("c");
    expect(expandedTokens).toContain("ca");
    expect(expandedTokens).toContain("cat");
    expect(expandedTokens).toContain("a");
    expect(expandedTokens).toContain("at");
    expect(expandedTokens).toContain("t");
  });
});
