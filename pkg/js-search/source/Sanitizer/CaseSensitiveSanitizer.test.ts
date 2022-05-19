import { CaseSensitiveSanitizer } from "./CaseSensitiveSanitizer";
describe('CaseSensitiveSanitizer', () => {
  it('should handle falsy values', () => {
    const sanitizer = new CaseSensitiveSanitizer();
    expect(sanitizer.sanitize(null)).toEqual('');
    expect(sanitizer.sanitize(undefined)).toEqual('');
    expect(sanitizer.sanitize(false)).toEqual('');
  });
  it('should handle empty strings', () => {
    const sanitizer = new CaseSensitiveSanitizer();
    expect(sanitizer.sanitize('')).toEqual('');
  });
  it('should handle whitespace-only strings', () => {
    const sanitizer = new CaseSensitiveSanitizer();
    expect(sanitizer.sanitize('  ')).toEqual('');
  });
  it('should handle leading and trailing whitespace', () => {
    const sanitizer = new CaseSensitiveSanitizer();
    expect(sanitizer.sanitize(' a')).toEqual('a');
    expect(sanitizer.sanitize('b ')).toEqual('b');
    expect(sanitizer.sanitize(' c ')).toEqual('c');
  });
  it('should not modify case', () => {
    const sanitizer = new CaseSensitiveSanitizer();
    expect(sanitizer.sanitize('AbC')).toEqual('AbC');
  });
});