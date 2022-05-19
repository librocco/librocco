import { TokenHighlighter } from "./TokenHighlighter";
describe('TokenHighlighter', () => {
  it('should handle empty strings', () => {
    const tokenHighlighter = new TokenHighlighter();
    const text = '';
    expect(tokenHighlighter.highlight(text, [])).toEqual(text);
  });
  it('should not highlight strings without matches', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['foo'];
    const text = 'bar baz';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(text);
  });
  it('should highlight tokens that equal the full string', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['foo'];
    const text = 'foo';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(tokenHighlighter._wrapText(text));
  });
  it('should not highlight words ending with tokens', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['bar'];
    const text = 'foobar';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(text);
  });
  it('should highlight multiple matches for multiple tokens', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['bar', 'baz'];
    const text = 'foo bar baz foo';
    const expectedText = 'foo ' + tokenHighlighter._wrapText('bar') + ' ' + tokenHighlighter._wrapText('baz') + ' foo';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(expectedText);
  });
  it('should highlight the last word in the text', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['bar'];
    const text = 'foo bar';

    const expectedText = 'foo ' + tokenHighlighter._wrapText('bar');

    expect(tokenHighlighter.highlight(text, tokens)).toEqual(expectedText);
  });
  it('should highlight the first word in the text', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['foo'];
    const text = 'foo bar';
    const expectedText = tokenHighlighter._wrapText('foo') + ' bar';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(expectedText);
  });
  it('should highlight tokens within tokens', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['foo', 'foobar'];
    const text = 'bar foobar baz';
    const expectedText = 'bar ' + tokenHighlighter._wrapText(tokenHighlighter._wrapText('foo') + 'bar') + ' baz';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(expectedText);
  });
  it('should highlight using sanitized text', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['foo', 'BAR'];
    const text = 'Foo bar baz';
    const expectedText = tokenHighlighter._wrapText('Foo') + ' ' + tokenHighlighter._wrapText('bar') + ' baz';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(expectedText);
  });
  it('should highlight the correct words regardless of leading or trailing spaces', () => {
    const tokenHighlighter = new TokenHighlighter();
    const tokens = ['foo', 'baz'];
    const text = '  foo bar baz ';
    const expectedText = '  ' + tokenHighlighter._wrapText('foo') + ' bar ' + tokenHighlighter._wrapText('baz') + ' ';
    expect(tokenHighlighter.highlight(text, tokens)).toEqual(expectedText);
  });
});