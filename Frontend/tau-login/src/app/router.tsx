import PageMotion from "@/components/layout/PageMotion";
import RouteError from "@/components/layout/RouteError";
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AppLayout from "@/components/layout/AppLayout";

import DashboardPage from "../pages/dashboard/DashboardPage";
import ProfilePage from "../pages/profile/ProfilePage";
import { PublicRouteSync, AdminRouteSync, AdminOnlyRouteSync } from "@/shared/routes/guards";
import CatalogListPage from "../pages/catalog/CatalogListPage";
import CatalogDetailPage from "../pages/catalog/CatalogDetailPage";
import BookNotesPage from "../pages/notes/BookNotesPage";
import MyShelfPage from "../pages/shelf/MyShelfPage";
import FavoritesPage from "../pages/favorites/FavoritesPage";
import SearchResultsPage from "../pages/search/SearchResultsPage";
import IntelligentSearchPage from "../pages/intelligent/IntelligentSearchPage";
import AdminLayout from "../pages/admin/AdminLayout";
import NotFoundPage from "../pages/NotFoundPage";
import AnalyticsLayout from "../pages/analytics/AnalyticsLayout";
import ContentLayout from "../pages/content/ContentLayout";
import PublicHomePage from "../pages/public/PublicHomePage";
import AboutPage from "../pages/public/AboutPage";
import UsefulLinksPage from "../pages/public/UsefulLinksPage";
import PublicTeachersPage from "../pages/public/PublicTeachersPage";
import PublicStudentsPage from "../pages/public/PublicStudentsPage";
import PublicResourcesPage from "../pages/public/PublicResourcesPage";
import PublicUsefulLinksPage from "../pages/public/PublicUsefulLinksPage";
import PublicContentPage from "../pages/public/PublicContentPage";

// Route modules resolve before navigation commits, so the previous page remains
// readable while the editor or PDF engine loads and the page transition stays intact.
function loadPage(importPage: () => Promise<{ default: ComponentType }>, title: string) {
  return async () => ({ Component: titledPage((await importPage()).default, title) });
}
const readerRoute = loadPage(() => import('../pages/reader/ReaderPage'), 'Reader - TAU');
const pageEditorRoute = loadPage(() => import('../pages/admin/sections/PageEditorPage'), 'Edit Content Page - TAU');
function titledPage(Page: ComponentType, title: string) {
  return function TitledPage() { return <WithTitle title={title}><Page /></WithTitle>; };
}

function readTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
  } catch {
    return null;
  }
}

function RootGate() {
  const token = readTokenFromStorage();
  const loc = useLocation();
  if (!token) {
    if (loc.pathname === "/") return <PublicHomePage />;
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <AppLayout />;
}

function WithTitle({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
  return children;
}

const router = createBrowserRouter([{ element: <PageMotion />, errorElement: <RouteError />, children: [
  // Public landing (available for both anonymous and authenticated users)
  { path: "/public", element: <PublicHomePage /> },
  { path: "/public/teachers", element: <WithTitle title="Teachers - TAU"><PublicTeachersPage /></WithTitle> },
  { path: "/public/teachers/citation-index", lazy: loadPage(()=>import('../pages/public/teachers/CitationIndexPage'), 'Индекс цитирования - TAU') },
  { path: "/public/teachers/gost-publications", lazy: loadPage(()=>import('../pages/public/teachers/GostPublicationsPage'), 'Оформление публикаций - TAU') },
  { path: "/public/teachers/acquisition-requests", lazy: loadPage(()=>import('../pages/public/teachers/AcquisitionRequestsPage'), 'Приобретение литературы - TAU') },
  { path: "/public/students", element: <WithTitle title="Students - TAU"><PublicStudentsPage /></WithTitle> },
  { path: "/public/students/database-instructions", lazy: loadPage(()=>import('../pages/public/students/DatabaseInstructionsPage'), 'Инструкции по базам данных - TAU') },
  { path: "/public/students/bibliographic-list", lazy: loadPage(()=>import('../pages/public/students/BibliographicListPage'), 'Список литературы - TAU') },
  { path: "/public/students/udc-bbk", lazy: loadPage(()=>import('../pages/public/students/UdcBbkPage'), 'Индекс УДК/ББК - TAU') },
  { path: "/public/students/lost-book", lazy: loadPage(()=>import('../pages/public/students/LostBookPage'), 'Утрата книги - TAU') },
  { path: "/public/students/digital-copies", lazy: loadPage(()=>import('../pages/public/students/DigitalCopiesPage'), 'Цифровые копии - TAU') },
  { path: "/public/students/reading-room", lazy: loadPage(()=>import('../pages/public/students/ReadingRoomPage'), 'Читальный зал - TAU') },
  { path: "/public/resources", element: <WithTitle title="Resources - TAU"><PublicResourcesPage /></WithTitle> },
  { path: "/public/page/:slug", element: <WithTitle title="Page - TAU"><PublicContentPage /></WithTitle> },
  { path: "/public/links/:category", element: <WithTitle title="Useful Links - TAU"><PublicUsefulLinksPage /></WithTitle> },
  { path: "/public/links", element: <WithTitle title="Useful Links - TAU"><PublicUsefulLinksPage /></WithTitle> },
  { path: "/public/about", element: <WithTitle title="About - TAU"><AboutPage /></WithTitle> },
  { path: "/login", element: <PublicRouteSync><WithTitle title="Login - TAU"><LoginPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/login", element: <PublicRouteSync><WithTitle title="Login - TAU"><LoginPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/register", element: <PublicRouteSync><WithTitle title="Register - TAU"><RegisterPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/forgot", element: <PublicRouteSync><WithTitle title="Forgot Password - TAU"><ForgotPasswordPage /></WithTitle></PublicRouteSync> },
  { path: "/about", element: <WithTitle title="About - TAU"><AboutPage /></WithTitle> },
  { path: "/links/:category", element: <WithTitle title="Useful Links - TAU"><UsefulLinksPage /></WithTitle> },
  { path: "/links", element: <WithTitle title="Useful Links - TAU"><UsefulLinksPage /></WithTitle> },
  { path: "*", element: <WithTitle title="404 - TAU"><NotFoundPage /></WithTitle> },
  {
    path: "/",
    element: <RootGate />,
      children: [
      { index: true, element: <WithTitle title="Dashboard - TAU"><DashboardPage /></WithTitle> },
      { path: "profile", element: <WithTitle title="Profile - TAU"><ProfilePage /></WithTitle> },
      { path: "catalog", element: <WithTitle title="Catalog - TAU"><CatalogListPage /></WithTitle> },
      { path: "search", element: <WithTitle title="Search - TAU"><SearchResultsPage /></WithTitle> },
      { path: "intelligent-search", element: <WithTitle title="Intelligent Search - TAU"><IntelligentSearchPage /></WithTitle> },
      {
        path: "analytics",
        element: (
          <AdminRouteSync>
            <WithTitle title="Analytics - TAU"><AnalyticsLayout /></WithTitle>
          </AdminRouteSync>
        ),
        children: [
          { index: true, lazy: loadPage(() => import("../pages/analytics/sections/AnalyticsOverviewPage"), "Analytics Overview - TAU") },
          { path: "users", lazy: loadPage(() => import("../pages/analytics/sections/AnalyticsUsersPage"), "Analytics Users - TAU") },
          { path: "traffic", lazy: loadPage(() => import("../pages/analytics/sections/AnalyticsTrafficPage"), "Analytics Traffic - TAU") },
          { path: "books", lazy: loadPage(() => import("../pages/analytics/sections/AnalyticsBooksPage"), "Analytics Books - TAU") },
        ],
      },
      {
        path: "content",
        element: (
          <AdminOnlyRouteSync>
            <WithTitle title="Content - TAU"><ContentLayout /></WithTitle>
          </AdminOnlyRouteSync>
        ),
        children: [
          { index: true, element: <Navigate to="/content/pages" replace /> },
          { path: "pages", lazy: loadPage(() => import("../pages/admin/sections/PagesPage"), "Content Pages - TAU") },
          { path: "pages/new", lazy: pageEditorRoute },
          { path: "pages/:id", lazy: pageEditorRoute },
          { path: "menu", lazy: loadPage(() => import("../pages/admin/sections/MenuPage"), "Content Menu - TAU") },
          { path: "menu/new", lazy: loadPage(() => import("../pages/admin/sections/MenuEditorPage"), "Create Content Menu Item - TAU") },
          { path: "menu/:id", lazy: loadPage(() => import("../pages/admin/sections/MenuEditorPage"), "Edit Content Menu Item - TAU") },
        ],
      },
      { path: "catalog/:id", element: <WithTitle title="Book Details - TAU"><CatalogDetailPage /></WithTitle> },
      { path: "catalog/books/:id", element: <WithTitle title="Book Details - TAU"><CatalogDetailPage /></WithTitle> },
      { path: "catalog/:id/notes", element: <WithTitle title="My Notes - TAU"><BookNotesPage /></WithTitle> },
      { path: "shelf", element: <WithTitle title="My Shelf - TAU"><MyShelfPage /></WithTitle> },
      { path: "favorites", element: <WithTitle title="Favorites - TAU"><FavoritesPage /></WithTitle> },
      { path: "reader", lazy: readerRoute },
        {
          path: "admin",
          element: (
            <AdminRouteSync>
              <WithTitle title="Admin - TAU"><AdminLayout /></WithTitle>
            </AdminRouteSync>
          ),
          children: [
            { index: true, lazy: loadPage(() => import("../pages/admin/AdminHome"), "Admin Home - TAU") },
            { path: "books", lazy: loadPage(() => import("../pages/admin/sections/BooksListPage"), "Admin Books - TAU") },
            { path: "books/new", lazy: loadPage(() => import("../pages/admin/CreateBookPage"), "Add Book - TAU") },
            { path: "articles/quick", lazy: loadPage(() => import("../pages/admin/QuickArticlePage"), "Quick Article - TAU") },
            {
              path: "content",
              element: (
                <AdminOnlyRouteSync>
                  <Navigate to="/content/pages" replace />
                </AdminOnlyRouteSync>
              ),
            },
            { path: "pages", element: <Navigate to="/content/pages" replace /> },
            { path: "books/:id", lazy: loadPage(() => import("../pages/admin/AdminBookDetailPage"), "Book Details - TAU") },
            { path: "books/:id/edit", lazy: loadPage(() => import("../pages/admin/EditBookPage"), "Edit Book - TAU") },
            { path: "playlists", lazy: loadPage(() => import("../pages/admin/sections/PlaylistsListPage"), "Admin Playlists - TAU") },
            { path: "playlists/new", lazy: loadPage(() => import("../pages/admin/CreatePlaylistPage"), "Add Playlist - TAU") },
            { path: "playlists/:id/edit", lazy: loadPage(() => import("../pages/admin/EditPlaylistPage"), "Edit Playlist - TAU") },
            { path: "users", lazy: loadPage(() => import("../pages/admin/sections/UsersPage"), "Admin Users - TAU") },
            { path: "users/:id", lazy: loadPage(() => import("../pages/admin/sections/UserDetailPage"), "User Details - TAU") },
            { path: "authors", lazy: loadPage(() => import("../pages/admin/sections/AuthorsPage"), "Admin Authors - TAU") },
            { path: "authors/:id/edit", lazy: loadPage(() => import("../pages/admin/EditAuthorPage"), "Edit Author - TAU") },
            { path: "subjects", lazy: loadPage(() => import("../pages/admin/sections/SubjectsPage"), "Admin Subjects - TAU") },
            { path: "subjects/:id/edit", lazy: loadPage(() => import("../pages/admin/EditSubjectPage"), "Edit Subject - TAU") },
            { path: "files", lazy: loadPage(() => import("../pages/admin/sections/FilesPage"), "Admin Files - TAU") },
            { path: "roles", lazy: loadPage(() => import("../pages/admin/sections/RolesPage"), "Admin Roles - TAU") },
            { path: "reports", lazy: loadPage(() => import("../pages/admin/sections/ReportsPage"), "Admin Reports - TAU") },
            { path: "menu", element: <Navigate to="/content/menu" replace /> },
            { path: "integrations", lazy: loadPage(() => import("../pages/admin/sections/IntegrationsPage"), "Admin Integrations - TAU") },
            { path: "settings", lazy: loadPage(() => import("../pages/admin/sections/SettingsPage"), "Admin Settings - TAU") },
            { path: "protection", lazy: loadPage(() => import("../pages/admin/sections/ProtectionPage"), "Admin Protection - TAU") },
          ],
        },
    ],
  },
]}]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
