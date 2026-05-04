export const OPERATING_UNITS_PATH = "/admin/operating-units";
export const NEW_OPERATING_UNIT_PATH = `${OPERATING_UNITS_PATH}/new`;

export function operatingUnitDetailPath(slug: string): string {
  return `${OPERATING_UNITS_PATH}/${encodeURIComponent(slug)}`;
}

export function operatingUnitEditPath(slug: string): string {
  return `${operatingUnitDetailPath(slug)}/edit`;
}

export function withUnitStatus(path: string, status: string): string {
  return `${path}?unit=${encodeURIComponent(status)}`;
}
