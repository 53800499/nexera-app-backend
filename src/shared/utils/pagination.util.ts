/** ENF — listes paginées à 50 par défaut, max 100. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(
  page?: string | number,
  limit?: string | number,
): { page: number; limit: number } {
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE),
  );
  return { page: parsedPage, limit: parsedLimit };
}
