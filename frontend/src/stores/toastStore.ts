import { create } from "zustand";

import type { Toast, ToastKind } from "@/types";

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `toast-${Date.now().toString(36)}-${counter}`;
}

/**
 * Global toast queue. Components call `useToastStore.getState().push({...})`
 * (or the `useToasts` hook) from anywhere — including axios error handlers.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = nextId();
    const duration = toast.duration ?? (toast.kind === "error" ? 8000 : 4500);
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id, duration }] }));

    if (duration > 0 && typeof window !== "undefined") {
      window.setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/** Convenience helpers used across the app. */
export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: "success", title, message }),
  error: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: "error", title, message }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: "warning", title, message }),
  info: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: "info", title, message }),
};

export type { Toast, ToastKind };
