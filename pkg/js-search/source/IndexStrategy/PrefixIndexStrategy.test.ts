import { PrefixIndexStrategy } from "./PrefixIndexStrategy";
describe('PrefixIndexStrategy', function () {
  const indexStrategy;
  beforeEach(function () {
    indexStrategy = new PrefixIndexStrategy();
  });
  it('should not expand empty tokens', function () {
    const expandedTokens = indexStrategy.expandToken('');
    expect(expandedTokens.length).toEqual(0);
  });
  it('should not expand single character tokens', function () {
    const expandedTokens = indexStrategy.expandToken('a');
    expect(expandedTokens.length).toEqual(1);
    expect(expandedTokens).toContain('a');
  });
  it('should expand multi-character tokens', function () {
    const expandedTokens = indexStrategy.expandToken('cat');
    expect(expandedTokens.length).toEqual(3);
    expect(expandedTokens).toContain('c');
    expect(expandedTokens).toContain('ca');
    expect(expandedTokens).toContain('cat');
  });
});