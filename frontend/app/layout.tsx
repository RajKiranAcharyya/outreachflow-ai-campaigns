import Link from 'next/link';
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50">
        <aside className="w-72 bg-gray-900 text-white flex flex-col border-r border-gray-800">
          <div className="p-8">
            <h1 className="text-2xl font-black tracking-tighter text-indigo-400">Outreach<span className="text-white">Flow</span></h1>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-bold">Cold Email Automation</p>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <Link href="/" className="sidebar-link active">Dashboard</Link>
            <Link href="/campaigns" className="sidebar-link inactive">Campaigns</Link>
            <Link href="/contacts" className="sidebar-link inactive">Contacts</Link>
          </nav>

          <div className="p-4 border-t border-gray-800">
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 text-center">
              <p className="text-xs font-bold text-yellow-500 uppercase">Sandbox Mode</p>
              <p className="text-[10px] text-yellow-600 mt-1">No real emails sent</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 py-6 px-10 flex justify-between items-center z-10">
            <h2 className="text-xl font-bold text-gray-900">Platform Overview</h2>
            <div className="flex items-center gap-3">
              <button className="text-sm font-semibold text-gray-500 hover:text-gray-900">Settings</button>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">AS</div>
            </div>
          </header>
          <div className="p-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
