import AppShell from "@/components/layout/AppShell";
import MobilePageShell from "@/components/layout/MobilePageShell";
import MasterDetailBuildings from "@/components/buildings/MasterDetailBuildings";

export default function BuildingsPage() {
  return (
    <AppShell>
      <MobilePageShell>
        <div className="relative w-full flex flex-col gap-[16px] md:gap-[20px] pb-[0px] md:pb-[30px] lg:pb-[40px] overflow-hidden min-h-full">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366f1]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        <MasterDetailBuildings />
        </div>
      </MobilePageShell>
    </AppShell>
  );
}
