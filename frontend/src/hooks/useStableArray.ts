import { useMemo } from "react";

/**
 * Estabiliza a referência de um array baseado em uma chave de identidade.
 * Resolve o "array churn" de bibliotecas como Apollo/GraphQL.
 */
export function useStableArray<T>(
  array: T[],
  identitySelector: (item: T) => string | number,
): T[] {
  const sentinel = array.map(identitySelector).join(",");

  // Only `sentinel` (the derived string) drives stability — not `array` itself.
  // Including `array` would defeat the purpose: Apollo returns a new reference
  // on every poll even when the data is identical, causing downstream effects
  // to fire on every poll interval.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (sentinel ? array : []), [sentinel]);
}
