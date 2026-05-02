import { APP_LOCALE } from "@/lib/app-config";

export function compareText(a: string, b: string, locale: string = APP_LOCALE): number {
  return a.localeCompare(b, locale);
}

export function sortText(values: string[], locale: string = APP_LOCALE): string[] {
  return [...values].sort((a, b) => compareText(a, b, locale));
}

export function compareByText<T>(
  getValue: (item: T) => string,
  locale: string = APP_LOCALE
): (a: T, b: T) => number {
  return (a, b) => compareText(getValue(a), getValue(b), locale);
}

export function compareNullableText(a: string, b: string): number {
  if (a !== b) return compareText(a, b);
  return 0;
}

export function compareTextDesc(a: string, b: string): number {
  return compareText(b, a);
}
