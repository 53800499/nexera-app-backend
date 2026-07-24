/**
 * RM-E01 — format : [CODE_ENTREPÔT]-[ZONE]-[ALLÉE]-[RAYON]-[CASE]
 */
export function buildLocationCode(parts: {
  warehouseCode: string;
  zone: string;
  aisle: string;
  rack: string;
  bin: string;
}): string {
  const normalize = (value: string) => value.trim().toUpperCase();
  return [
    normalize(parts.warehouseCode),
    normalize(parts.zone),
    normalize(parts.aisle),
    normalize(parts.rack),
    normalize(parts.bin),
  ].join('-');
}
