'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

interface Step {
  step_number: number;
  delay_minutes: number;
  subject_template: string;
  body_template: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const [steps, setSteps] = useState<Step[]>([
    {
      step_number: 1,
      delay_minutes: 0,
      subject_template: 'Quick question about {{company}}',
      body_template: 'Hi {{first_name}},\n\n{{ai_opening}}\n\nI was impressed by what you and your team are building at {{company}}. Would you be open to a 10-minute chat this week?\n\nBest,\nRaj',
    },
    {
      step_number: 2,
      delay_minutes: 1440, // 24 hours
      subject_template: 'Following up regarding {{company}}',
      body_template: 'Hi {{first_name}},\n\nJust bumping this in your inbox in case it got buried under other priorities.\n\nLet me know if you have a few minutes.\n\nBest,\nRaj',
    },
  ]);

  const addStep = () => {
    const nextStepNum = steps.length + 1;
    setSteps([
      ...steps,
      {
        step_number: nextStepNum,
        delay_minutes: 2880, // 48 hours
        subject_template: `Checking in one last time`,
        body_template: `Hi {{first_name}},\n\nWanted to follow up one final time regarding {{company}}.\n\nBest regards,\nRaj`,
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    const updated = steps.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      step_number: idx + 1,
    }));
    setSteps(updated);
  };

  const updateStep = (index: number, field: keyof Step, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const insertVariable = (index: number, variableTag: string) => {
    const currentBody = steps[index].body_template;
    updateStep(index, 'body_template', currentBody + ' ' + variableTag);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a campaign name');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name,
          daily_limit: Number(dailyLimit),
          steps,
        }),
      });

      if (res.ok) {
        const campaign = await res.json();
        router.push(`/campaigns/${campaign.id}`);
      } else {
        const err = await res.json();
        alert('Failed: ' + (err.error?.message || 'Error creating campaign'));
      }
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Create New Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure sequence steps, delays, templates, and AI personalization tokens.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Settings Card */}
        <div className="card space-y-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">General Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Campaign Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 SaaS Founders Outreach"
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Daily Send Limit (emails / day)</label>
              <input
                type="number"
                min={1}
                max={500}
                required
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Sequence Steps */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Email Sequence Steps ({steps.length})
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              + Add Step
            </button>
          </div>

          {steps.map((step, idx) => (
            <div key={idx} className="card relative border-l-4 border-l-indigo-600 space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 text-base">Step {step.step_number}</span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                  >
                    Remove Step
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Subject Line Template</label>
                  <input
                    type="text"
                    required
                    value={step.subject_template}
                    onChange={(e) => updateStep(idx, 'subject_template', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Delay Before Sending (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={step.delay_minutes}
                    onChange={(e) => updateStep(idx, 'delay_minutes', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {step.delay_minutes === 0 ? 'Sends immediately upon enrollment' : `${Math.round(step.delay_minutes / 60)} hour(s) delay`}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">Email Body Template</label>
                  <div className="flex gap-1.5 text-[11px] items-center">
                    <span className="text-gray-400">Insert tag:</span>
                    {['{{first_name}}', '{{company}}', '{{role}}', '{{ai_opening}}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertVariable(idx, tag)}
                        className="bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-0.5 rounded text-gray-700 font-mono transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={6}
                  required
                  value={step.body_template}
                  onChange={(e) => updateStep(idx, 'body_template', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm font-sans focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.push('/campaigns')}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {submitting ? 'Creating Sequence...' : 'Save & Launch Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
