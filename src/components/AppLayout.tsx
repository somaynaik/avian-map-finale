import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import { useLocation } from "react-router-dom";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const isMapPage = location.pathname === "/";

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <main className={isMapPage ? "h-screen w-screen overflow-hidden relative" : "pb-[var(--nav-height)] print:pb-0"}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
