import { ExactWordIndexStrategy } from "./ExactWordIndexStrategy";
describe('ExactWordIndexStrategy', function () {
  const indexStrategy;
  beforeEach(function () {
    indexStrategy = new ExactWordIndexStrategy();
  });
  it('should not expand empty tokens', function () {
    const expandedTokens = indexStrategy.expandToken('');
    expect(expandedTokens.length).toEqual(0);
  });
  it('should not expand tokens', function () {
    const expandedTokens = indexStrategy.expandToken('cat');
    expect(expandedTokens.length).toEqual(1);
    expect(expandedTokens).toContain('cat');
  });
});