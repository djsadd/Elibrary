import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useEffect } from "react";
import type { ReactNode } from "react";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AppLayout from "@/components/layout/AppLayout";

import DashboardPage from "../pages/dashboard/DashboardPage";
import ProfilePage from "../pages/profile/ProfilePage";
import { ProtectedRoute, PublicRoute, ProtectedRouteSync, PublicRouteSync } from "@/shared/routes/guards";
import CatalogListPage from "../pages/catalog/CatalogListPage";
import CatalogDetailPage from "../pages/catalog/CatalogDetailPage";
import BookNotesPage from "../pages/notes/BookNotesPage";
import MyShelfPage from "../pages/shelf/MyShelfPage";
import FavoritesPage from "../pages/favorites/FavoritesPage";
import ReaderPage from "../pages/reader/ReaderPage";
import SearchResultsPage from "../pages/search/SearchResultsPage";
import IntelligentSearchPage from "../pages/intelligent/IntelligentSearchPage";
import AdminLayout from "../pages/admin/AdminLayout";
import AdminHome from "../pages/admin/AdminHome";
import CreateBookPage from "../pages/admin/CreateBookPage";
import CreatePlaylistPage from "../pages/admin/CreatePlaylistPage";
import BooksListPage from "../pages/admin/sections/BooksListPage";
import PlaylistsListPage from "../pages/admin/sections/PlaylistsListPage";
import EditBookPage from "../pages/admin/EditBookPage";
import EditPlaylistPage from "../pages/admin/EditPlaylistPage";
import UsersPage from "../pages/admin/sections/UsersPage";
import UserDetailPage from "../pages/admin/sections/UserDetailPage";
import AuthorsPage from "../pages/admin/sections/AuthorsPage";
import EditAuthorPage from "../pages/admin/EditAuthorPage";
import SubjectsPage from "../pages/admin/sections/SubjectsPage";
import EditSubjectPage from "../pages/admin/EditSubjectPage";
import FilesPage from "../pages/admin/sections/FilesPage";
import SettingsPage from "../pages/admin/sections/SettingsPage";
import IntegrationsPage from "../pages/admin/sections/IntegrationsPage";
import ReportsPage from "../pages/admin/sections/ReportsPage";
import RolesPage from "../pages/admin/sections/RolesPage";
import NotFoundPage from "../pages/NotFoundPage";
import AnalyticsLayout from "../pages/analytics/AnalyticsLayout";
import AnalyticsOverviewPage from "../pages/analytics/sections/AnalyticsOverviewPage";
import AnalyticsUsersPage from "../pages/analytics/sections/AnalyticsUsersPage";
import AnalyticsTrafficPage from "../pages/analytics/sections/AnalyticsTrafficPage";
import AnalyticsBooksPage from "../pages/analytics/sections/AnalyticsBooksPage";

function WithTitle({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
  return children;
}

const router = createBrowserRouter([
  { path: "/login", element: <PublicRouteSync><WithTitle title="Login - TAU"><LoginPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/login", element: <PublicRouteSync><WithTitle title="Login - TAU"><LoginPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/register", element: <PublicRouteSync><WithTitle title="Register - TAU"><RegisterPage /></WithTitle></PublicRouteSync> },
  { path: "/auth/forgot", element: <PublicRouteSync><WithTitle title="Forgot Password - TAU"><ForgotPasswordPage /></WithTitle></PublicRouteSync> },
  { path: "*", element: <WithTitle title="404 - TAU"><NotFoundPage /></WithTitle> },
  {
    path: "/",
    element: (
      <ProtectedRouteSync>
        <AppLayout />
      </ProtectedRouteSync>
    ),
      children: [
      { index: true, element: <WithTitle title="Dashboard - TAU"><DashboardPage /></WithTitle> },
      { path: "profile", element: <WithTitle title="Profile - TAU"><ProfilePage /></WithTitle> },
      { path: "catalog", element: <WithTitle title="Catalog - TAU"><CatalogListPage /></WithTitle> },
      { path: "search", element: <WithTitle title="Search - TAU"><SearchResultsPage /></WithTitle> },
      { path: "intelligent-search", element: <WithTitle title="Intelligent Search - TAU"><IntelligentSearchPage /></WithTitle> },
      {
        path: "analytics",
        element: <WithTitle title="Analytics - TAU"><AnalyticsLayout /></WithTitle>,
        children: [
          { index: true, element: <WithTitle title="Analytics Overview - TAU"><AnalyticsOverviewPage /></WithTitle> },
          { path: "users", element: <WithTitle title="Analytics Users - TAU"><AnalyticsUsersPage /></WithTitle> },
          { path: "traffic", element: <WithTitle title="Analytics Traffic - TAU"><AnalyticsTrafficPage /></WithTitle> },
          { path: "books", element: <WithTitle title="Analytics Books - TAU"><AnalyticsBooksPage /></WithTitle> },
        ],
      },
      { path: "catalog/:id", element: <WithTitle title="Book Details - TAU"><CatalogDetailPage /></WithTitle> },
      { path: "catalog/books/:id", element: <WithTitle title="Book Details - TAU"><CatalogDetailPage /></WithTitle> },
      { path: "catalog/:id/notes", element: <WithTitle title="My Notes - TAU"><BookNotesPage /></WithTitle> },
      { path: "shelf", element: <WithTitle title="My Shelf - TAU"><MyShelfPage /></WithTitle> },
      { path: "favorites", element: <WithTitle title="Favorites - TAU"><FavoritesPage /></WithTitle> },
      { path: "reader", element: <WithTitle title="Reader - TAU"><ReaderPage /></WithTitle> },
        {
          path: "admin",
          element: <WithTitle title="Admin - TAU"><AdminLayout /></WithTitle>,
          children: [
            { index: true, element: <WithTitle title="Admin Home - TAU"><AdminHome /></WithTitle> },
            { path: "books", element: <WithTitle title="Admin Books - TAU"><BooksListPage /></WithTitle> },
            { path: "books/new", element: <WithTitle title="Add Book - TAU"><CreateBookPage /></WithTitle> },
            { path: "books/:id/edit", element: <WithTitle title="Edit Book - TAU"><EditBookPage /></WithTitle> },
            { path: "playlists", element: <WithTitle title="Admin Playlists - TAU"><PlaylistsListPage /></WithTitle> },
            { path: "playlists/new", element: <WithTitle title="Add Playlist - TAU"><CreatePlaylistPage /></WithTitle> },
            { path: "playlists/:id/edit", element: <WithTitle title="Edit Playlist - TAU"><EditPlaylistPage /></WithTitle> },
            { path: "users", element: <WithTitle title="Admin Users - TAU"><UsersPage /></WithTitle> },
            { path: "users/:id", element: <WithTitle title="User Details - TAU"><UserDetailPage /></WithTitle> },
            { path: "authors", element: <WithTitle title="Admin Authors - TAU"><AuthorsPage /></WithTitle> },
            { path: "authors/:id/edit", element: <WithTitle title="Edit Author - TAU"><EditAuthorPage /></WithTitle> },
            { path: "subjects", element: <WithTitle title="Admin Subjects - TAU"><SubjectsPage /></WithTitle> },
            { path: "subjects/:id/edit", element: <WithTitle title="Edit Subject - TAU"><EditSubjectPage /></WithTitle> },
            { path: "files", element: <WithTitle title="Admin Files - TAU"><FilesPage /></WithTitle> },
            { path: "roles", element: <WithTitle title="Admin Roles - TAU"><RolesPage /></WithTitle> },
            { path: "reports", element: <WithTitle title="Admin Reports - TAU"><ReportsPage /></WithTitle> },
            { path: "integrations", element: <WithTitle title="Admin Integrations - TAU"><IntegrationsPage /></WithTitle> },
            { path: "settings", element: <WithTitle title="Admin Settings - TAU"><SettingsPage /></WithTitle> },
          ],
        },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
