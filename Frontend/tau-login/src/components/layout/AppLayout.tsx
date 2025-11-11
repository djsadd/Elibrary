import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import { SidebarProvider, useSidebar } from "../../shared/SidebarContext";

function LayoutInner() {
  const { isOpen, close, open } = useSidebar();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* fixed mobile hamburger so it's always reachable on small screens */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button onClick={open} className="p-2 rounded-md bg-white shadow-sm hover:bg-slate-100">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* main area: sidebar flush to the left on md+, overlay on small when open */}
      <div className="flex flex-1">
        {/* persistent sidebar on md+ */}
        <aside className="hidden md:block w-56 border-r bg-white">
          <Sidebar />
        </aside>

        {/* content area */}
        <main className="flex-1 p-6">
          {/* mobile hamburger to open sidebar */}
          <div className="md:hidden mb-4">
            <button onClick={open} className="p-2 rounded-md hover:bg-slate-100">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <Outlet />
        </main>
      </div>

      <Footer />

      {/* mobile overlay sidebar */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r shadow-lg">
            <div className="p-4 flex justify-end">
              <button onClick={close} className="p-2 rounded-md hover:bg-slate-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
}
