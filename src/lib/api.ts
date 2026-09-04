import type { SiteContent, StoredMessage, MediaItem } from "@/types/content"
import fallback from "@/data/content.json"

export const fallbackContent = fallback as unknown as SiteContent

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) detail = data.error
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  return (await res.json()) as T
}

export function fetchContent() {
  return request<SiteContent>("/api/content")
}

export function saveContent(content: SiteContent) {
  return request<{ ok: true; url: string }>("/api/content", {
    method: "PUT",
    body: JSON.stringify(content),
  })
}

export function checkSession() {
  return request<{ authenticated: boolean }>("/api/admin/session")
}

export function login(password: string) {
  return request<{ ok: true }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  })
}

export function logout() {
  return request<{ ok: true }>("/api/admin/session", { method: "DELETE" })
}

export function fetchMessages() {
  return request<{ messages: StoredMessage[] }>("/api/messages")
}

export function submitMessage(payload: Record<string, string>) {
  return request<{ ok: true }>("/api/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function markMessageRead(id: string) {
  return request<{ ok: true; messages: StoredMessage[] }>(`/api/messages?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
  })
}

export function deleteMessage(id: string) {
  return request<{ ok: true; messages: StoredMessage[] }>(`/api/messages?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export function fetchMedia() {
  return request<{ media: MediaItem[] }>("/api/admin/media")
}

export function deleteMedia(url: string) {
  return request<{ ok: true }>(`/api/admin/media?url=${encodeURIComponent(url)}`, {
    method: "DELETE",
  })
}
