'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface Contact {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  role?: string;
  note?: string;
  status: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  // Form for single contact
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company: '',
    role: '',
    note: '',
  });

  const loadContacts = async () => {
    try {
      const res = await apiFetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/contacts/import', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      setImportResult(data);
      if (res.ok) {
        loadContacts();
      }
    } catch (err) {
      alert('Error importing CSV: ' + err);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ email: '', first_name: '', last_name: '', company: '', role: '', note: '' });
        loadContacts();
      } else {
        const err = await res.json();
        alert('Failed: ' + (err.error?.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error adding contact: ' + err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const res = await apiFetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts(contacts.filter((c) => c.id !== id));
      }
    } catch (err) {
      alert('Delete failed: ' + err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Contacts & Leads</h1>
          <p className="text-gray-500 text-sm mt-1">Manage leads, verify emails, and import bulk contacts via CSV.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setImportResult(null);
              setShowImportModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-gray-900 font-bold">No contacts found</p>
            <p className="text-gray-500 text-sm mt-1">Import contacts via CSV to begin campaign enrollments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-400 font-semibold text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {c.first_name || c.last_name ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.email}</td>
                    <td className="px-6 py-4 text-gray-600">{c.company || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{c.role || '—'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          c.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Import Contacts from CSV</h3>
            <p className="text-xs text-gray-500 mb-4">
              Columns recognized: <code>email</code>, <code>first_name</code>, <code>last_name</code>, <code>company</code>, <code>role</code>, <code>note</code>.
            </p>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Or Paste CSV Content</label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`email,first_name,company,role\nalice@example.com,Alice,Acme Corp,CTO`}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              {importResult && (
                <div className="p-3 bg-gray-50 border rounded-xl text-xs space-y-1">
                  <p className="font-bold text-gray-900">Import Summary:</p>
                  <p className="text-emerald-600 font-semibold">✓ Successfully imported: {importResult.imported}</p>
                  <p className="text-amber-600">⚠ Duplicates skipped: {importResult.skippedDuplicates}</p>
                  <p className="text-rose-600">✕ Invalid rows rejected: {importResult.invalidRows}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-semibold rounded-xl shadow-sm"
                >
                  Import Contacts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Single Contact</h3>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Note (for AI context)</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="e.g. Scaling their backend team"
                  className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-semibold rounded-xl shadow-sm"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
