import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle({ variant = "default" }: { variant?: "default" | "catalog" }) {
  const { theme, toggleTheme } = useTheme();

  if (variant === "catalog") {
    return (
      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        data-testid="button-theme-toggle"
      >
        {theme === "light" ? (
          <Moon className="h-5 w-5 text-gray-600 dark:text-white/70" />
        ) : (
          <Sun className="h-5 w-5 text-gray-600 dark:text-white/70" />
        )}
        <span className="sr-only">Переключить тему</span>
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
      <span className="sr-only">Переключить тему</span>
    </Button>
  );
}
