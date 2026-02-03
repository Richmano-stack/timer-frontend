import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-white p-4 gap-4 overflow-hidden font-[family-name:var(--font-inter)]">
            {/* 1. Sidebar handles its own internal session logic */}
            <Sidebar />

            <main className="flex-1 overflow-y-auto bg-gray-100 rounded-2xl shadow-md relative">
                <div className="absolute inset-0 p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
