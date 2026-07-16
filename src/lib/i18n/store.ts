import { derived } from "svelte/store";
import { page } from "$app/stores";
import {
  createTranslator,
  DEFAULT_LOCALE,
  formatDate,
  formatDistance,
  formatMoney,
  formatNumber,
  formatPreciseMoney,
  type Locale,
} from "./index";

/**
 * Derived from `page` rather than held in a module-level writable. On the
 * server a module-level store is shared by every in-flight request, so one
 * user's locale would bleed into another's response. `page` is per-request
 * context, which makes this safe under SSR.
 */
export const locale = derived(
  page,
  ($page) =>
    (($page.data as { locale?: Locale }).locale ?? DEFAULT_LOCALE) as Locale,
);

/** Usage: `{$t('nav.dashboard')}` */
export const t = derived(locale, ($locale) => createTranslator($locale));

/** Locale-bound formatters, so pages never name a locale themselves. */
export const format = derived(locale, ($locale) => ({
  money: (cents: number) => formatMoney($locale, cents),
  preciseMoney: (millicents: number) => formatPreciseMoney($locale, millicents),
  number: (value: number, options?: Intl.NumberFormatOptions) =>
    formatNumber($locale, value, options),
  distance: (km: number) => formatDistance($locale, km),
  date: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
    formatDate($locale, value, options),
}));
