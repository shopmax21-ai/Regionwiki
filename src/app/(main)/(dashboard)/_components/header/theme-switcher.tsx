"use client";

import { Moon, Sun } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export function ThemeSwitcher() {
  const { themeMode, setPreference } = usePreferencesStore(
    useShallow((state) => ({
      themeMode: state.values.theme_mode,
      setPreference: state.setPreference,
    })),
  );

  const toggleTheme = () => {
    setPreference("theme_mode", themeMode === "dark" ? "light" : "dark");
  };

  return (
    <Button
      size="icon"
      onClick={toggleTheme}
      aria-label={themeMode === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {/* Тёмная тема: показываем солнце (переключить на светлую) */}
      <Sun className="hidden dark:block" />
      {/* Светлая тема: показываем луну (переключить на тёмную) */}
      <Moon className="block dark:hidden" />
    </Button>
  );
}
