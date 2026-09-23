import { useCallback, useEffect, useRef, useState } from "react"
import type { DragEvent } from "react"

/**
 * Drag-to-reorder for admin list editors (Services, Projects, About image slots).
 *
 * Mouse-only by design: dragging is armed by pressing the card's drag handle
 * (GripVertical), so text selection in the card's inputs keeps working. Arrow
 * up/down buttons remain the keyboard and touch path — HTML5 drag events don't
 * fire on touch screens.
 *
 * The reorder happens live during dragover (the card follows the cursor), so
 * no separate drop indicator is needed: the list itself is the preview.
 */
export function useListDrag(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [armedKey, setArmedKey] = useState<string | null>(null)
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder

  // Releasing the handle without starting a drag should disarm.
  useEffect(() => {
    if (!armedKey) return
    const clear = () => setArmedKey(null)
    window.addEventListener("pointerup", clear)
    return () => window.removeEventListener("pointerup", clear)
  }, [armedKey])

  const end = useCallback(() => {
    setDragIndex(null)
    setArmedKey(null)
  }, [])

  return {
    dragIndex,
    end,
    /** Spread onto the drag handle element. */
    handleProps: (itemKey: string) => ({
      onPointerDown: () => setArmedKey(itemKey),
      onPointerUp: () => setArmedKey(null),
    }),
    /** Spread onto the draggable card/row element. */
    itemProps: (index: number, itemKey: string) => ({
      draggable: armedKey === itemKey,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move"
        // Firefox requires data to be set for the drag to start.
        e.dataTransfer.setData("text/plain", String(index))
        setDragIndex(index)
      },
      onDragOver: (e: DragEvent) => {
        if (dragIndex === null) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (index !== dragIndex) {
          reorderRef.current(dragIndex, index)
          setDragIndex(index)
        }
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        end()
      },
      onDragEnd: end,
    }),
  }
}
