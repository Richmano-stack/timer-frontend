import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { api } from "@/lib/api";
import { User } from "@/types";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Timer App",
  description: "Team status tracking application",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user: User | null = null;

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Only attempt to fetch user if there are cookies
    if (cookieHeader) {
      user = await api.get<User>('/api/auth/me', {
        headers: { Cookie: cookieHeader }
      });
    }
  } catch (error) {
    // User not logged in or API error
    user = null;
  }

  if (!user) {
    return (
      <html lang="en">
        <body className={inter.className}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-50">
          <Sidebar user={user} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Topbar user={user} />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
