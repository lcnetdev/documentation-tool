import { describe, it, expect } from 'vitest';
import { formatEmptyRdfXml, parseEmptyRdfRoot } from '../services/rdfEmptyRoot';

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const BF = 'http://id.loc.gov/ontologies/bibframe/';

describe('rdfEmptyRoot', () => {
  it('lays out a namespace-only root one declaration per line', () => {
    const source = `<rdf:RDF\n    xmlns:rdf="${RDF_NS}" xmlns:bf="${BF}"\n    />\n`;
    expect(formatEmptyRdfXml(source)).toBe(`<rdf:RDF\n    xmlns:rdf="${RDF_NS}"\n    xmlns:bf="${BF}"\n/>`);
  });

  it('keeps an explicit closing tag, other prefixes and single-quoted values', () => {
    const root = parseEmptyRdfRoot(`<r:RDF xmlns:r='${RDF_NS}' xml:base="http://x/"></r:RDF>`);
    expect(root.prefix).toBe('r');
    expect(root.selfClosing).toBe(false);
    expect(root.attributes).toEqual([{ name: 'xmlns:r', value: RDF_NS }, { name: 'xml:base', value: 'http://x/' }]);
    expect(formatEmptyRdfXml(`<r:RDF xmlns:r='${RDF_NS}' xml:base="http://x/"></r:RDF>`))
      .toBe(`<r:RDF\n    xmlns:r="${RDF_NS}"\n    xml:base="http://x/"\n>\n</r:RDF>`);
  });

  it('leaves documents with content, fragments and bare roots alone', () => {
    expect(formatEmptyRdfXml(`<rdf:RDF xmlns:rdf="${RDF_NS}"><bf:Work/></rdf:RDF>`)).toBeNull();
    expect(formatEmptyRdfXml('<bf:Work rdf:about="http://x/1"/>')).toBeNull();
    expect(formatEmptyRdfXml('<rdf:RDF/>')).toBeNull();
    expect(formatEmptyRdfXml('')).toBeNull();
    expect(parseEmptyRdfRoot('<rdf:RDF/>')).toEqual({ prefix: 'rdf', attributes: [], selfClosing: true });
  });
});
