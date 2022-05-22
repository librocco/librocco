import { ExactWordIndexStrategy } from "./ExactWordIndexStrategy";
describe("ExactWordIndexStrategy", () => {
  it("should not expand empty tokens", () => {
    const indexStrategy = new ExactWordIndexStrategy();
    const expandedTokens = indexStrategy.expandToken("");
    expect(expandedTokens.length).toEqual(0);
  });
  it("should not expand tokens", () => {
    const indexStrategy = new ExactWordIndexStrategy();
    const expandedTokens = indexStrategy.expandToken("cat");
    expect(expandedTokens.length).toEqual(1);
    expect(expandedTokens).toContain("cat");
  });
});
