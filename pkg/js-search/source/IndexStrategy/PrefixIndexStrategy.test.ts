import { PrefixIndexStrategy } from "./PrefixIndexStrategy";
describe('PrefixIndexStrategy', function () {
  it('should not expand empty tokens', function () {
    const indexStrategy = new PrefixIndexStrategy();
    const expandedTokens = indexStrategy.expandToken('');
    expect(expandedTokens.length).toEqual(0);
  });
  it('should not expand single character tokens', function () {
    const indexStrategy = new PrefixIndexStrategy();
    const expandedTokens = indexStrategy.expandToken('a');
    expect(expandedTokens.length).toEqual(1);
    expect(expandedTokens).toContain('a');
  });
  it('should expand multi-character tokens', function () {
    const indexStrategy = new PrefixIndexStrategy();
    const expandedTokens = indexStrategy.expandToken('cat');
    expect(expandedTokens.length).toEqual(3);
    expect(expandedTokens).toContain('c');
    expect(expandedTokens).toContain('ca');
    expect(expandedTokens).toContain('cat');
  });
});