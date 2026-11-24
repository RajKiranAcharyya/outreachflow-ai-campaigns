'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const loadCampaign = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`/api/campaigns/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
      }
    } catch (err) {
      console.error('Error loading campaign', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaign();
    const interval = setInterval(loadCampaign, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await apiFetch(`/api/campaigns/${id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Enrolled ${data.enrolledCount} contacts into sequence!`);
        loadCampaign();
      } else {
        alert('Enrollment failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Error during enrollment: ' + err);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400">Loading campaign details...</div>;
  }

  if (!campaign) {
    return (
      <div className="p-16 text-center">
        <h2 className="text-xl font-bold text-gray-900">Campaign Not Found</h2>
        <Link href="/campaigns" className="text-indigo-600 text-sm font-semibold mt-4 inline-block">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/campaigns" className="text-xs font-semibold text-gray-400 hover:text-gray-600">
              Campaigns
            </Link>
            <span className="text-xs text-gray-300">/</span>
            <h1 className="text-2xl font-black text-gray-900">{campaign.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              {campaign.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Daily Send Limit: <strong>{campaign.daily_limit}</strong> emails/day
          </p>
        </div>

        <button
          onClick={handleEnroll}
          disabled={enrolling}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50"
        >
          {enrolling ? 'Enrolling & Personalizing...' : '⚡ Enroll Active Contacts'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 uppercase">Sent</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{campaign.stats?.sent ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 uppercase">Opened</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{campaign.stats?.opened ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 uppercase">Pending In Queue</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{campaign.stats?.pending ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 uppercase">Failed</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{campaign.stats?.failed ?? 0}</p>
        </div>
      </div>

      {/* Sequence Steps */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Sequence Pipeline Steps</h2>
        <div className="space-y-3">
          {campaign.steps?.map((step: any) => (
            <div key={step.id} className="card border-l-4 border-l-indigo-600">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-gray-900 text-sm">Step {step.step_number}</span>
                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                  Delay: {step.delay_minutes} min ({step.delay_minutes === 0 ? 'immediate' : `${Math.round(step.delay_minutes / 60)}h`})
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-700">Subject: {step.subject_template}</p>
              <p className="text-xs text-gray-500 font-mono mt-2 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                {step.body_template}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Enrolled Contacts */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          Enrolled Contacts ({campaign.enrollments?.length || 0})
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {campaign.enrollments?.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No contacts enrolled yet. Click &quot;Enroll Active Contacts&quot; above to start the sequence.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-400 font-semibold text-xs uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Company</th>
                    <th className="px-6 py-4">Current Step</th>
                    <th className="px-6 py-4">AI Opening Line</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaign.enrollments?.map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">
                          {e.first_name} {e.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{e.email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{e.company || '—'}</td>
                      <td className="px-6 py-4 font-semibold text-gray-700">Step {e.current_step}</td>
                      <td className="px-6 py-4 text-xs text-indigo-700 max-w-xs italic">
                        &quot;{e.ai_opening || '—'}&quot;
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            e.status === 'completed'
                              ? 'bg-blue-50 text-blue-700'
                              : e.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
