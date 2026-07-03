import React, { createContext, useContext } from "react";

const TabsContextInstance = createContext<{
  value: string;
  onValueChange?: (val: string) => void;
} | null>(null);

export function Tabs({ value, onValueChange, children, className = "", ...props }: any) {
  return (
    <TabsContextInstance.Provider value={{ value, onValueChange }}>
      <div className={className} {...props}>{children}</div>
    </TabsContextInstance.Provider>
  );
}

export function TabsList({ children, className = "", ...props }: any) {
  return <div className={`flex gap-2 ${className}`} {...props}>{children}</div>;
}

export function TabsTrigger({ value, children, className = "", ...props }: any) {
  const context = useContext(TabsContextInstance);
  const isActive = context?.value === value;
  return (
    <button
      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${
        isActive
          ? "bg-primary text-white shadow-md scale-[1.02]"
          : "text-muted hover:bg-surface/80"
      } ${className}`}
      onClick={() => context?.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = "", ...props }: any) {
  const context = useContext(TabsContextInstance);
  const isActive = context?.value === value;
  if (!isActive) return null;
  return <div className={className} {...props}>{children}</div>;
}
