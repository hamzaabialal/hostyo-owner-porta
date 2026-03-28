import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit Expense | Hostyo",
  description: "Submit work details and expense for a reservation",
};

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
