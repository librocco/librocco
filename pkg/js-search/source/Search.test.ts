import { Search } from "./Search";

type Document = Record<string, any>;

describe("Search", () => {
  let documentBar: Document;
  let documentBaz: Document;
  let documentFoo: Document;
  let nestedDocumentFoo: Document;
  let search: Search;

  const validateSearchResults = (
    results: Document[],
    expectedDocuments: Document[]
  ) => {
    expect(results.length).toBe(expectedDocuments.length);
    expectedDocuments.forEach((document) => {
      expect(results).toContain(document);
    });
  };

  beforeEach(() => {
    search = new Search("uid");
    documentBar = {
      uid: "bar",
      title: "Bar",
      description: "This is a document about bar",
      aNumber: 0,
      aBoolean: false,
    };
    documentBaz = {
      uid: "baz",
      title: "BAZ",
      description: "All about baz",
      array: ["test", true, 456],
    };
    documentFoo = {
      uid: "foo",
      title: "foo",
      description: "Is kung foo the same as kung fu?",
      aNumber: 167543,
      aBoolean: true,
      array: [123, "test", "foo"],
    };
    nestedDocumentFoo = {
      uid: "foo",
      title: "foo",
      description: "Is kung foo the same as kung fu?",
      nested: {
        title: "nested foo",
      },
    };
  });
  it("should throw an error if instantiated without the :uidFieldName parameter", () => {
    expect(() => {
      // @ts-expect-error testing error handling
      new Search();
    }).toThrow();
  });
  it("should index a new document on all searchable fields", () => {
    search.addIndex("title");
    jest.spyOn(search._indexStrategy, "expandToken").mockReturnValue([]);
    search.addDocument(documentBar);
    expect(search._indexStrategy.expandToken).toHaveBeenCalledWith("bar");
  });
  it("should re-index existing documents if a new searchable field is added", () => {
    search.addDocument(documentBar);
    jest.spyOn(search._indexStrategy, "expandToken").mockReturnValue([]);
    search.addIndex("title");
    expect(search._indexStrategy.expandToken).toHaveBeenCalledWith("bar");
  });
  it("should find matches for all searchable fields", () => {
    search.addIndex("title");
    search.addIndex("description");
    search.addDocument(documentFoo);
    // Search title text
    validateSearchResults(search.search("foo"), [documentFoo]);
    // Search description text
    validateSearchResults(search.search("kung"), [documentFoo]);
  });
  it("should find no matches if none exist", () => {
    search.addIndex("title");
    search.addDocument(documentFoo);
    validateSearchResults(search.search("xyz"), []);
  });
  it("should find no matches if one token is empty", () => {
    search.addIndex("title");
    search.addDocument(documentFoo);
    validateSearchResults(search.search("foo xyz"), []);
  });
  it("should index and find non-string values if they can be converted to strings", () => {
    search.addIndex("aBoolean");
    search.addIndex("aNumber");
    search.addDocument(documentBar);
    search.addDocument(documentFoo);
    validateSearchResults(search.search("167"), [documentFoo]);
    validateSearchResults(search.search("true"), [documentFoo]);
    validateSearchResults(search.search("0"), [documentBar]);
    validateSearchResults(search.search("false"), [documentBar]);
  });
  it("should stringified arrays", () => {
    search.addIndex("array");
    search.addDocuments([documentFoo, documentBaz]);
    validateSearchResults(search.search("test"), [documentFoo, documentBaz]);
    validateSearchResults(search.search("true"), [documentBaz]);
    validateSearchResults(search.search("456"), [documentBaz]);
  });
  it("should index nested document properties", () => {
    search.addIndex(["nested", "title"]);
    search.addDocument(nestedDocumentFoo);
    validateSearchResults(search.search("nested foo"), [nestedDocumentFoo]);
  });
  it("should gracefully handle broken property path", () => {
    search.addIndex(["nested", "title", "not", "existing"]);
    search.addDocument(nestedDocumentFoo);
    validateSearchResults(search.search("nested foo"), []);
  });
  it("should support nested uid paths", () => {
    const melissaSmith = {
      name: "Melissa Smith",
      email: "melissa.allen@example.com",
      login: {
        userId: 2562,
        username: "heavycat937",
      },
    };
    const johnSmith = {
      name: "John Smith",
      email: "john.allen@example.com",
      login: {
        userId: 54213,
        username: "jhon123",
      },
    };
    const search = new Search(["login", "userId"]);
    search.addIndex("title");
    search.addIndex(["login", "username"]);
    search.addIndex("name");
    search.addIndex("email");
    search.addDocuments([melissaSmith, johnSmith]);
    validateSearchResults(search.search("Smith"), [melissaSmith, johnSmith]);
    validateSearchResults(search.search("allen"), [melissaSmith, johnSmith]);
    validateSearchResults(search.search("heavycat937"), [melissaSmith]);
    validateSearchResults(search.search("jhon123"), [johnSmith]);
  });
});
