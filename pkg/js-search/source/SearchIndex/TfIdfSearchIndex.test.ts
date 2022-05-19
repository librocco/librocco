import { Search } from "../Search";
import { TfIdfSearchIndex } from "./TfIdfSearchIndex";
describe('Search', () => {
  let documents, search, uid;

  const addDocument = (title) => {
    const document = {
      uid: ++uid,
      title: title
    };
    documents.push(document);
    search.addDocument(document);
    return document;
  };

  beforeEach(() => {
    documents = [];
    uid = 0;
    search = new Search('uid');
    search.searchIndex = new TfIdfSearchIndex('uid');
    search.addIndex('title');
    const titles = ['this document is about node.', 'this document is about ruby.', 'this document is about ruby and node.', 'this document is about node. it has node examples'];

    for (let i = 0, length = titles.length; i < length; ++i) {
      addDocument(titles[i]);
    }
  });

  const calculateIdf = (numDocumentsWithToken) => {
    return 1 + Math.log(search._documents.length / (1 + numDocumentsWithToken));
  };

  const assertIdf = (term, numDocumentsWithToken) => {
    const _calculateIdf = search.searchIndex._createCalculateIdf();

    expect(_calculateIdf(term, search._documents)).toEqual(calculateIdf(numDocumentsWithToken));
  };

  it('should handle special words like "constructor"', () => {
    addDocument('constructor');
  });
  describe('IDF', () => {
    it('should compute for tokens appearing only once', () => {
      assertIdf('and', 1);
    });
    it('should compute for tokens appearing once in each document', () => {
      assertIdf('document', 4);
    });
    it('should compute for tokens appearing multiple times in a document', () => {
      assertIdf('node', 3);
    });
    it('should compute for tokens that are not within the corpus', () => {
      assertIdf('foobar', 0);
    });
    it('should clear IFD cache if new documents are indexed', () => {
      assertIdf('ruby', 2);
      addDocument('this document is not about ruby.');
      assertIdf('ruby', 3);
    });
  });

  const calculateTfIdf = (numDocumentsWithToken, tokenCountInDocument) => {
    return calculateIdf(numDocumentsWithToken) * tokenCountInDocument;
  };

  const assertTfIdf = (terms, document, expectedTfIdf) => {
    const _calculateTfIdf = search.searchIndex._createCalculateTfIdf();

    expect(_calculateTfIdf(terms, document, search._documents)).toEqual(expectedTfIdf);
  };

  describe('TF-IDF', () => {
    it('should compute for single tokens within the corpus', () => {
      assertTfIdf(['node'], documents[0], calculateTfIdf(3, 1));
      assertTfIdf(['node'], documents[3], calculateTfIdf(3, 2));
    });
    it('should compute for tokens not within the document', () => {
      assertTfIdf(['node'], documents[1], calculateTfIdf(3, 0));
      assertTfIdf(['has node'], documents[1], calculateTfIdf(3, 0));
    });
    it('should compute for multiple tokens within the corpus', () => {
      assertTfIdf(['document', 'node'], documents[3], calculateTfIdf(4, 1) + calculateTfIdf(3, 2));
      assertTfIdf(['ruby', 'and'], documents[2], calculateTfIdf(2, 1) + calculateTfIdf(1, 1));
    });
    it('should compute for tokens that are not within the corpus', () => {
      assertTfIdf(['foobar'], [], 0);
      assertTfIdf(['foo', 'bar'], [], 0);
    });
  });
  describe('search', () => {
    it('should order search results by TF-IDF descending', () => {
      const results = search.search('node');
      expect(results.length).toEqual(3);
      // The 4th document has "node" twice so it should be first of the 3
      // The order of the other results isn't important for this test.
      expect(results[0]).toEqual(documents[3]);
    });
    it('should give documents containing words with a lower IDF a higher relative ranking', () => {
      const documentA = addDocument('foo bar foo bar baz baz baz baz');
      const documentB = addDocument('foo bar foo foo baz baz baz baz');
      const documentC = addDocument('foo bar baz bar baz baz baz baz');

      for (let i = 0; i < 10; i++) {
        addDocument('foo foo baz foo foo baz foo foo baz foo foo baz foo foo baz foo foo baz foo foo baz foo foo');
      }

      const results = search.search('foo bar');
      expect(results.length).toEqual(3);
      // Document A should come first because it has 2 "bar" (which have a lower total count) and 2 "foo"
      // Document C should come first because it has 2 "bar" (which have a lower total count) but only 1 "foo"
      // Document B should come last because although it has 3 "foo" it has only 1 "bar"
      expect(results[0]).toEqual(documentA);
      expect(results[1]).toEqual(documentC);
      expect(results[2]).toEqual(documentB);
    });
  });
  it('should support nested uid paths', () => {
    const melissaSmith = {
      name: 'Melissa Smith',
      login: {
        userId: 2562
      }
    };
    const johnSmith = {
      name: 'John Smith',
      login: {
        userId: 54213
      }
    };
    const searchIndex = new TfIdfSearchIndex(['login', 'userId']);
    searchIndex.indexDocument(['Melissa'], 2562, melissaSmith);
    searchIndex.indexDocument(['Smith'], 2562, melissaSmith);
    searchIndex.indexDocument(['John'], 54213, johnSmith);
    searchIndex.indexDocument(['Smith'], 54213, johnSmith);
    expect(searchIndex.search(['Melissa'], [melissaSmith, johnSmith])).toEqual([melissaSmith]);
    expect(searchIndex.search(['John'], [melissaSmith, johnSmith])).toEqual([johnSmith]);
    expect(searchIndex.search(['Smith'], [melissaSmith, johnSmith])).toEqual([melissaSmith, johnSmith]);
  });
});