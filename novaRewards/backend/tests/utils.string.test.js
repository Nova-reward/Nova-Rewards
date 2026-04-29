const { capitalize, toSnakeCase, truncate, slugify, mask } = require('../src/utils/string');

describe('string utils', () => {
  it('capitalize', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('')).toBe('');
  });

  it('toSnakeCase', () => {
    expect(toSnakeCase('camelCase')).toBe('camel_case');
    expect(toSnakeCase('myVarName')).toBe('my_var_name');
  });

  it('truncate', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('slugify', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  Nova Rewards  ')).toBe('nova-rewards');
  });

  it('mask', () => {
    expect(mask('1234567890', 4)).toBe('******7890');
    expect(mask('abc', 4)).toBe('abc');
  });
});
