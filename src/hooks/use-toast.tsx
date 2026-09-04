"use client"

import { useState, createContext, useContext, useCallback, type ReactNode } from "react"

type ToastVariant = "default" | "destructive"

type Toast = {
  id: number
  title: string
  description?: string
  variant?: ToastVariant
}

type ToastContextValue = {
  toast: (props: { title: string; description?: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback(({ title, description, variant = "default" }: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, title, description, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`w-80 rounded border p-3 shadow ${
              t.variant === "destructive" ? "border-red-400 bg-red-50 text-red-900" : "border-brand-dark bg-white text-brand-dark"
            }`}
          >
            <div className="font-semibold text-sm">{t.title}</div>
            {t.description ? <div className="text-xs mt-1 opacity-80">{t.description}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
