const { unique, groupBy, chunk, sortBy, flatten } = require('../src/utils/array');

describe('array utils', () => {
  it('unique removes duplicates', () => expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3]));

  it('groupBy groups by key', () => {
    const result = groupBy([{ type: 'a' }, { type: 'b' }, { type: 'a' }], (x) => x.type);
    expect(result.a).toHaveLength(2);
    expect(result.b).toHaveLength(1);
  });

  it('chunk splits array', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('sortBy sorts ascending', () => {
    const sorted = sortBy([{ n: 3 }, { n: 1 }, { n: 2 }], 'n');
    expect(sorted.map((x) => x.n)).toEqual([1, 2, 3]);
  });

  it('sortBy sorts descending', () => {
    const sorted = sortBy([{ n: 1 }, { n: 3 }, { n: 2 }], 'n', 'desc');
    expect(sorted.map((x) => x.n)).toEqual([3, 2, 1]);
  });

  it('flatten flattens one level', () => expect(flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]));
});
