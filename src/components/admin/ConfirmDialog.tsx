import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Lightweight confirmation dialog (no Radix dependency). Focus lands on the
 * destructive action, Enter confirms, Escape cancels — same flow as the
 * Media page's delete confirmation.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-lg border bg-white p-5 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-brand-dark">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant="destructive"
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
