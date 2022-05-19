import { Search } from "../Search";
import { UnorderedSearchIndex } from "./UnorderedSearchIndex";
describe('Search', function () {
  const validateSearchResults = function (results, expectedDocuments) {
    expect(results.length).toBe(expectedDocuments.length);
    expectedDocuments.forEach(function (document) {
      expect(results).toContain(document);
    });
  };

  it('should return documents matching search tokens', function () {
    const search = new Search('uid');
    search.searchIndex = new UnorderedSearchIndex();
    search.addIndex('title');
    const titles = ['this document is about node.', 'this document is about ruby.', 'this document is about ruby and node.', 'this document is about node. it has node examples'];
    const documents = [];

    for (let i = 0, length = titles.length; i < length; ++i) {
      const document = {
        uid: i,
        title: titles[i]
      };
      documents.push(document);
      search.addDocument(document);
    }

    const results = search.search('node');
    validateSearchResults(results, [documents[0], documents[2], documents[3]]);
  });
});