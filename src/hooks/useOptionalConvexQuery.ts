"use client";

import { useConvex } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

type OptionalQueryState<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  unavailable: boolean;
};

function isMissingFunctionError(message: string): boolean {
  return message.includes("Could not find public function");
}

function getQueryPath(queryRef: any): string {
  if (!queryRef) return "";
  if (typeof queryRef === "string") return queryRef;
  const candidate =
    queryRef.__path ??
    queryRef._name ??
    queryRef.path ??
    queryRef._referencePath ??
    queryRef.referencePath;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  return "query";
}

function isSameState<T>(left: OptionalQueryState<T>, right: OptionalQueryState<T>): boolean {
  return (
    left.loading === right.loading &&
    left.unavailable === right.unavailable &&
    left.error === right.error &&
    Object.is(left.data, right.data)
  );
}

export function useOptionalConvexQuery<T = any>(
  queryRef: any,
  args: Record<string, any> | "skip" | undefined,
  enabled: boolean = true
): OptionalQueryState<T> {
  const convex = useConvex();
  const convexRef = useRef(convex);

  useEffect(() => {
    convexRef.current = convex;
  }, [convex]);

  const queryKey = useMemo(() => getQueryPath(queryRef), [queryRef]);
  const argsKey = useMemo(() => {
    if (args === "skip" || !args) return "skip";
    try {
      return JSON.stringify(args);
    } catch {
      return "args";
    }
  }, [args]);

  const [state, setState] = useState<OptionalQueryState<T>>({
    data: undefined,
    error: null,
    loading: false,
    unavailable: false,
  });

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !queryRef || args === "skip" || !args) {
      setState((prev) => {
        const next = { ...prev, loading: false };
        return isSameState(prev, next) ? prev : next;
      });
      return;
    }

    setState((prev) => {
      const next = {
        ...prev,
        loading: true,
        error: null,
        unavailable: false,
      };
      return isSameState(prev, next) ? prev : next;
    });

    void convexRef.current
      .query(queryRef, args)
      .then((result) => {
        if (cancelled) return;
        setState((prev) => {
          const next = {
            data: result as T,
            error: null,
            loading: false,
            unavailable: false,
          };
          return isSameState(prev, next) ? prev : next;
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => {
          const next = {
            data: undefined,
            error: message,
            loading: false,
            unavailable: isMissingFunctionError(message),
          };
          return isSameState(prev, next) ? prev : next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [argsKey, enabled, queryKey]);

  return state;
}
