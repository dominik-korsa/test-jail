declare namespace Intl {
  interface ListFormatOptions {
    localeMatcher?: 'lookup' | 'best fit';
    type?: 'conjunction' | 'disjunction' | 'unit';
    style?: 'long' | 'short' | 'narrow';
  }
  interface ListFormatPart {
    type: 'element' | 'literal';
    value: string;
  }
  class ListFormat {
    constructor()
    constructor(locales: string | string[])
    constructor(locales: string | string[], options: ListFormatOptions)

    public format: (items: string[]) => string;

    public formatToParts: (items: string[]) => ListFormatPart[];
  }
}
