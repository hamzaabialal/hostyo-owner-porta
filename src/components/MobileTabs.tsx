"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
  exact?: boolean;
}

export default function MobileTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-0 border-b border-[#eaeaea] mb-4 -mx-4 px-4 md:hidden overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              active
                ? "text-accent border-accent"
                : "text-[#999] border-transparent hover:text-[#555]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
