/** Same rules as App\Support\Normalise on the server. */
export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function nameKey(value: string): string {
  return collapseSpaces(value).toLowerCase();
}
