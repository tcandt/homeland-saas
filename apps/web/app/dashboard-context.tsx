"use client";
import { createContext, useContext } from "react";

export const DashboardDataContext = createContext<any>(null);

export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  return context;
};
