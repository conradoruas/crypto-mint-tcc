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

  return useMemo(() => {
    return sentinel ? array : [];
  }, [sentinel, array]);
}
