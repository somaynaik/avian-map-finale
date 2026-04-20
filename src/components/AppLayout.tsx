import { ReactNode } from "react";
import BottomNav from "./BottomNav";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-[var(--nav-height)]">{children}</main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
