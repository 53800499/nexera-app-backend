import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parsePagination } from './pagination.util';

describe('pagination.util', () => {
  it('defaults to 50 items per page', () => {
    expect(parsePagination()).toEqual({ page: 1, limit: DEFAULT_PAGE_SIZE });
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it('caps limit at 100', () => {
    expect(parsePagination(1, 500).limit).toBe(MAX_PAGE_SIZE);
  });

  it('parses custom page and limit', () => {
    expect(parsePagination('2', '25')).toEqual({ page: 2, limit: 25 });
  });
});
