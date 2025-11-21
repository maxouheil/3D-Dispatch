'use client';

import { DashboardStats } from '@/lib/types';

interface DashboardKPIsProps {
  stats: DashboardStats;
}

export function DashboardKPIs({ stats }: DashboardKPIsProps) {
  const kpis = [
    {
      title: 'requests',
      value: stats.totalRequests,
    },
    {
      title: 'Backlog',
      value: stats.backlogRequests,
    },
    {
      title: 'ongoing',
      value: stats.ongoingRequests,
    },
    {
      title: 'sent',
      value: stats.sentRequests,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {kpis.map((kpi) => (
        <div
          key={kpi.title}
          className="bg-gray-100 rounded-lg p-4 text-center"
        >
          <div className="text-2xl font-semibold text-gray-900 mb-1">
            {kpi.value}
          </div>
          <div className="text-sm text-gray-600 capitalize">{kpi.title}</div>
        </div>
      ))}
    </div>
  );
}

