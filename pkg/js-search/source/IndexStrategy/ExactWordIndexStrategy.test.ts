import { ExactWordIndexStrategy } from "./ExactWordIndexStrategy";
describe('ExactWordIndexStrategy', function () {
  it('should not expand empty tokens', function () {
    const indexStrategy = new ExactWordIndexStrategy();
    const expandedTokens = indexStrategy.expandToken('');
    expect(expandedTokens.length).toEqual(0);
  });
  it('should not expand tokens', function () {
    const indexStrategy = new ExactWordIndexStrategy();
    const expandedTokens = indexStrategy.expandToken('cat');
    expect(expandedTokens.length).toEqual(1);
    expect(expandedTokens).toContain('cat');
  });
});