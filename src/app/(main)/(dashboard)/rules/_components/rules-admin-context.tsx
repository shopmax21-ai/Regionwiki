"use client";

import { createContext, type ReactNode, useContext } from "react";

const RulesAdminContext = createContext(false);

export function RulesAdminProvider({ canRefresh, children }: { canRefresh: boolean; children: ReactNode }) {
  return <RulesAdminContext.Provider value={canRefresh}>{children}</RulesAdminContext.Provider>;
}

/** true, если посетитель — Гл.Администратор и видит кнопку принудительного обновления правил. */
export const useCanRefreshRules = () => useContext(RulesAdminContext);
