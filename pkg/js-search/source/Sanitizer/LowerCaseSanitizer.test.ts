import { LowerCaseSanitizer } from "./LowerCaseSanitizer";
describe("LowerCaseSanitizer", () => {
  it("should handle falsy values", () => {
    const sanitizer = new LowerCaseSanitizer();
    expect(sanitizer.sanitize(null)).toEqual("");
    expect(sanitizer.sanitize(undefined)).toEqual("");
    expect(sanitizer.sanitize(false)).toEqual("");
  });
  it("should handle empty strings", () => {
    const sanitizer = new LowerCaseSanitizer();
    expect(sanitizer.sanitize("")).toEqual("");
  });
  it("should handle whitespace-only strings", () => {
    const sanitizer = new LowerCaseSanitizer();
    expect(sanitizer.sanitize("  ")).toEqual("");
  });
  it("should handle leading and trailing whitespace", () => {
    const sanitizer = new LowerCaseSanitizer();
    expect(sanitizer.sanitize(" a")).toEqual("a");
    expect(sanitizer.sanitize("b ")).toEqual("b");
    expect(sanitizer.sanitize(" c ")).toEqual("c");
  });
  it("should convert uppercase to lower case", () => {
    const sanitizer = new LowerCaseSanitizer();
    expect(sanitizer.sanitize("AbC")).toEqual("abc");
  });
});
