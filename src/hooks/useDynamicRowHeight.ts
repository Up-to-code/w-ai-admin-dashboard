import { useCallback, useEffect, useRef } from "react"
import { VariableSizeList } from "react-window"

interface UseDynamicRowHeightOptions {
  defaultRowHeight: number
  key?: string
}

export function useDynamicRowHeight({ defaultRowHeight, key }: UseDynamicRowHeightOptions) {
  const listRef = useRef<VariableSizeList>(null)
  const rowHeights = useRef<Record<number, number>>({})
  const lastKeyRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (lastKeyRef.current === undefined) {
      lastKeyRef.current = key
      return
    }
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key
    rowHeights.current = {}
    listRef.current?.resetAfterIndex(0, true)
  }, [key])

  const getRowHeight = useCallback(
    (index: number) => {
      return rowHeights.current[index] || defaultRowHeight
    },
    [defaultRowHeight]
  )

  const setRowHeight = useCallback((index: number, size: number) => {
    if (rowHeights.current[index] === size) return
    rowHeights.current[index] = size
    listRef.current?.resetAfterIndex(index)
  }, [])

  return {
    listRef,
    rowHeight: getRowHeight,
    setRowHeight,
  }
}
