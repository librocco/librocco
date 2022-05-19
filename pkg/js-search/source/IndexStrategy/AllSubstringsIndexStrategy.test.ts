import { AllSubstringsIndexStrategy } from "./AllSubstringsIndexStrategy";
describe('AllSubstringsIndexStrategy', function () {
  const indexStrategy;
  beforeEach(function () {
    indexStrategy = new AllSubstringsIndexStrategy();
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
    expect(expandedTokens.length).toEqual(6);
    expect(expandedTokens).toContain('c');
    expect(expandedTokens).toContain('ca');
    expect(expandedTokens).toContain('cat');
    expect(expandedTokens).toContain('a');
    expect(expandedTokens).toContain('at');
    expect(expandedTokens).toContain('t');
  });
});