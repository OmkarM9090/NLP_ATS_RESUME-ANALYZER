"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "resumeai:theme";

/**
 * Light/dark switch. The mode itself lives on `<html class="dark">` — applied
 * before first paint by the inline script in the root layout — so this button
 * only flips that class (plus the stored preference) and never re-renders the
 * tree. Icons are swapped with the `dark:` variant, which keeps the markup
 * identical on the server and the client.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — the class change still applies for this session */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-mist transition-colors duration-300 hover:bg-tint-2 hover:text-ink",
        className,
      )}
    >
      <Sun className="h-4 w-4 dark:hidden" strokeWidth={1.9} />
      <Moon className="hidden h-4 w-4 dark:block" strokeWidth={1.9} />
    </button>
  );
}
