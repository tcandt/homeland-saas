"use client";
import { createContext, useContext } from "react";
import { mockData } from "@/lib/mock-data";

export const DashboardDataContext = createContext<typeof mockData | null>(null);

export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  if (!context) return mockData; // Fallback
  return context;
};
