import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Book = {
  id: string;
  title: string;
  authors: string[];
  subjects: string[];
  created_at: string;
};

export default function AdminHome() {
  const [books, setBooks] = useState<Book[]>(() => {
    try { return JSON.parse(localStorage.getItem('books') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const onStorage = () => setBooks(JSON.parse(localStorage.getItem('books') || '[]'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const remove = (id: string) => {
    if (!confirm('Delete this book?')) return;
    const arr = books.filter(b => b.id !== id);
    localStorage.setItem('books', JSON.stringify(arr));
    setBooks(arr);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Admin Dashboard</h2>
        <div className="flex items-center gap-2">
          <Link to="books/new" className="px-4 py-2 bg-slate-700 text-white rounded-md">Add Book</Link>
          <Link to="playlists/new" className="px-4 py-2 bg-indigo-600 text-white rounded-md">Add Playlist</Link>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="text-sm text-slate-500">No books yet. Click "Add Book" to create one.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Title</th><th>Authors</th><th>Subjects</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {books.map(b => (
                <tr key={b.id} className="border-t">
                  <td className="py-2">{b.title}</td>
                  <td>{b.authors?.join(', ')}</td>
                  <td>{b.subjects?.join(', ')}</td>
                  <td className="text-xs text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="text-right">
                    <button onClick={() => remove(b.id)} className="px-2 py-1 text-sm border rounded-md">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
