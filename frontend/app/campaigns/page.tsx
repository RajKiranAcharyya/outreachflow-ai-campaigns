'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

interface Campaign {
  id: number;
  name: string;
  status: string;
  daily_limit: number;
  steps_count: number;
  enrollments_count: number;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);

  const loadCampaigns = async () => {
    try {
      const res = await apiFetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Error fetching campaigns', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleEnrollAll = async (campaignId: number) => {
    setEnrollingId(campaignId);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({}), // enroll all active contacts
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully enrolled ${data.enrolledCount} contacts into campaign sequence!`);
        loadCampaigns();
      } else {
        alert('Enrollment failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error during enrollment: ' + err);
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Outreach Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">
            Automate multi-step email sequences with delay intervals and Gemini-powered openers.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <p className="text-gray-900 font-bold">No campaigns created yet</p>
          <p className="text-gray-500 text-sm mt-1 mb-4">
            Set up your first email sequence with personalized opening lines and delays.
          </p>
          <Link
            href="/campaigns/new"
            className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow"
          >
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div key={c.id} className="card flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-900 text-lg">{c.name}</h3>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      c.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div className="bg-gray-50 p-2.5 rounded-lg">
                    <span className="font-semibold text-gray-900">{c.steps_count}</span> Sequence Steps
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg">
                    <span className="font-semibold text-gray-900">{c.enrollments_count}</span> Enrolled Leads
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg col-span-2">
                    Daily Send Limit: <span className="font-semibold text-gray-900">{c.daily_limit}</span> emails/day
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <Link
                  href={`/campaigns/${c.id}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  View Details & Stats →
                </Link>
                <button
                  onClick={() => handleEnrollAll(c.id)}
                  disabled={enrollingId === c.id}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {enrollingId === c.id ? 'Enrolling...' : '⚡ Enroll Active Leads'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
