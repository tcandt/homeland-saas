import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FileQuestion size={64} className="text-muted-foreground" />
        <h1 className="text-4xl font-bold">404 - Not Found</h1>
        <p className="text-muted-foreground">The page you are looking for does not exist.</p>
        <Link href="/" className="px-4 py-2 bg-primary text-white rounded-md mt-4 font-medium">
          Return Home
        </Link>
      </div>
    </AppShell>
  );
}
