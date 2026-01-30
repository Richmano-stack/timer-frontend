Architecture Spec: Dashboard Layout & Route Grouping1. The Core Problem (Post-Mortem)The previous approach failed because the Root Layout acted as a "Hard Gate." If the server-side fetch failed, the entire Sidebar component was omitted from the DOM, making it impossible to debug client-side auth or see the UI.2. The Solution: Route GroupsWe will use Next.js Route Groups (...). These allow us to share layouts across specific sets of routes without affecting the URL structure.New Folder HierarchyPlaintextapp/
├── (auth)/             <-- Logic for Login/Register
│   ├── layout.tsx      <-- Clean layout (No Sidebar)
│   └── login/
│       └── page.tsx
├── (dashboard)/        <-- Logic for Authenticated App
│   ├── layout.tsx      <-- The "Shell" (Sidebar + Topbar)
│   ├── dashboard/
│   │   └── page.tsx
│   └── profile/
│       └── page.tsx
├── layout.tsx          <-- Global Grammar (HTML, Body, Fonts)
└── globals.css
3. Implementation FilesA. The Global Root (app/layout.tsx)Keep this naked. It only defines the document structure.TypeScriptexport default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
B. The App Shell (app/(dashboard)/layout.tsx)This is where the "Grammar" of your dashboard lives. This layout only applies to routes inside the (dashboard) folder.TypeScriptimport { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-white p-4 gap-4 overflow-hidden">
      {/* 1. Sidebar handles its own internal 'useSession' logic */}
      <Sidebar /> 
      
      <main className="flex-1 overflow-y-auto bg-[#D9D9D9] rounded-2xl shadow-sm relative">
        <div className="absolute inset-0 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
4. Why This Approach WinsFeatureTechnical BenefitSeparationLogin pages stay clean. No "if pathname === '/login'" hacks.PersistenceMoving from /dashboard to /profile won't re-render the Sidebar.Client-First AuthThe Sidebar can safely use authClient.useSession(). If the session is missing, it returns null and the main content remains, allowing for a graceful "Please log in" UI or a redirect.DebuggabilityThe component is always "mounted" on dashboard routes, so your console.log and Network tab will always show activity.5. Tomorrow's Workflow (Action Plan)Create Folders: Create (auth) and (dashboard) directories inside /app.Move Files: * Move your login folder into (auth).Move your dashboard, profile, history, etc., into (dashboard).Refactor Layouts: Copy the code provided above into the respective layout.tsx files.Verify Authentication: * Open localhost:3000/dashboard.Check Console for AUTH_CHECK.Check Network for get-session.Fix the TS Error: Ensure your Sidebar.tsx uses the brace-protected if (!session) { ... } block to satisfy the TypeScript compiler.6. Pro-Tip: The "Middleware" GuardOnce the UI is visible, we secure it. Create a middleware.ts in your root to handle redirects if the session cookie is missing. This prevents unauthenticated users from even seeing the Dashboard HTML.