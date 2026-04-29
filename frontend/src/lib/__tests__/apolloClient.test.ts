import { describe, expect, it, vi } from "vitest";
import { ApolloClient, ApolloLink, InMemoryCache, gql } from "@apollo/client";
import { Observable } from "rxjs";
import { createSubgraphStateLink } from "@/lib/apolloClient";
import { SUBGRAPH_STATE_HEADER, type SubgraphState } from "@/lib/subgraphErrors";

/**
 * Stub terminating link that mimics HttpLink: it calls
 * operation.setContext({ response }) before emitting a result.
 */
function makeStubHttpLink(headerValue: string | null): ApolloLink {
  return new ApolloLink((operation) => {
    return new Observable<{ data: Record<string, unknown> }>((subscriber) => {
      const headers = new Headers();
      if (headerValue !== null) headers.set(SUBGRAPH_STATE_HEADER, headerValue);
      operation.setContext({ response: { headers } });
      subscriber.next({ data: { ok: true } });
      subscriber.complete();
    });
  });
}

async function executeQuery(link: ApolloLink): Promise<unknown> {
  const client = new ApolloClient({ link, cache: new InMemoryCache() });
  const result = await client.query({
    query: gql`
      query Hello {
        ok
      }
    `,
    fetchPolicy: "no-cache",
  });
  return result.data;
}

describe("createSubgraphStateLink", () => {
  it.each<[SubgraphState]>([["ok"], ["degraded"], ["down"]])(
    "calls onState with %s when the response carries that header",
    async (header) => {
      const onState = vi.fn();
      const link = ApolloLink.from([
        createSubgraphStateLink(onState),
        makeStubHttpLink(header),
      ]);

      await executeQuery(link);

      expect(onState).toHaveBeenCalledWith(header);
    },
  );

  it("does not call onState when the header is missing", async () => {
    const onState = vi.fn();
    const link = ApolloLink.from([
      createSubgraphStateLink(onState),
      makeStubHttpLink(null),
    ]);

    await executeQuery(link);

    expect(onState).not.toHaveBeenCalled();
  });

  it("ignores unrecognized header values", async () => {
    const onState = vi.fn();
    const link = ApolloLink.from([
      createSubgraphStateLink(onState),
      makeStubHttpLink("totally-not-a-state"),
    ]);

    await executeQuery(link);

    expect(onState).not.toHaveBeenCalled();
  });
});
