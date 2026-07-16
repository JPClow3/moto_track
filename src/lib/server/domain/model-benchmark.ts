/**
 * The "pt-BR" below is deliberately NOT the reader's locale and must not be
 * swapped for one. This builds a lookup key, not display text: it has to hash
 * identically for every reader, so the casing rules are pinned to one locale on
 * purpose. (Locale-aware casing is not academic — in tr, "I" lowercases to a
 * dotless "ı", which would key the same bike two different ways.)
 */
export function modelBenchmarkKey(brand: string, model: string, year: number) {
  return [brand, model, year]
    .map((value) =>
      String(value)
        .trim()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-"),
    )
    .filter(Boolean)
    .join(":");
}

export function benchmarkPosition(value: number, average: number) {
  if (average <= 0) return "sem comparação";
  const difference = (value - average) / average;
  if (difference > 0.1) return "acima da média";
  if (difference < -0.1) return "abaixo da média";
  return "na média";
}
