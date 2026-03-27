"use client";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="ml-[220px] flex-1 flex flex-col min-h-screen">
        <TopBar title={title} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
