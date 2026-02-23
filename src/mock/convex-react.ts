"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getVersion, resolveMutation, resolveQuery, subscribe } from "@/mock/backend";

function getPath(ref: any): string {
  if (!ref) return "";
  return String(ref.__path || ref.toString?.() || "");
}

function getSnapshot(): number {
  return getVersion();
}

export function useQuery(ref: any, args?: any): any {
  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const argsKey = useMemo(() => {
    try {
      return JSON.stringify(args ?? null);
    } catch {
      return "args";
    }
  }, [args]);
  return useMemo(() => resolveQuery(ref, args), [getPath(ref), argsKey, version]);
}

export function usePaginatedQuery(ref: any, args?: any, opts?: any): any {
  const results = useQuery(ref, args) ?? [];
  const initialNum = Number(opts?.initialNumItems ?? 50);
  const status = results.length > initialNum ? "CanLoadMore" : "Exhausted";
  const loadMore = () => undefined;
  return {
    results,
    status,
    isLoading: false,
    loadMore,
  };
}

export function useMutation(ref: any): (args?: any) => Promise<any> {
  return useCallback((args?: any) => resolveMutation(ref, args), [getPath(ref)]);
}

export function useAction(ref: any): (args?: any) => Promise<any> {
  return useCallback((args?: any) => resolveMutation(ref, args), [getPath(ref)]);
}

export function useConvex(): { query: (ref: any, args?: any) => Promise<any> } {
  return useMemo(
    () => ({
      query: async (ref: any, args?: any) => resolveQuery(ref, args),
    }),
    []
  );
}

export function ConvexProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  return children;
}

export class ConvexReactClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_url: string) {}
}
