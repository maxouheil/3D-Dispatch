'use client';

import { useState, useEffect } from 'react';
import { Request, Artist, DashboardStats } from '@/lib/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DashboardKPIs } from '@/components/admin/DashboardKPIs';
import { ArtistBacklogSummary } from '@/components/admin/ArtistBacklogSummary';
import { GoogleSheetsSync } from '@/components/admin/GoogleSheetsSync';
import { CSVMatching } from '@/components/admin/CSVMatching';
import { isBacklogStatus, isOngoingStatus, isSentStatus, isWithinCurrentWeek, getCurrentWeekRange, getSentDate } from '@/lib/utils';

export default function AdminDashboard() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    ongoingRequests: 0,
    sentRequests: 0,
    backlogRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, artistsRes] = await Promise.all([
        fetch('/api/requests'),
        fetch('/api/artists'),
      ]);

      const requestsData = await requestsRes.json();
      const artistsData = await artistsRes.json();

      setRequests(requestsData);
      setArtists(artistsData);

      // Calculate stats with new rules:
      // - Requests = backlog + ongoing (pas de filtre semaine)
      // - Backlog = new + pending (pas de filtre semaine)
      // - Ongoing = transmitted to 3D artist (pas de filtre semaine)
      // - Sent = sent to client (avec filtre semaine en cours)
      
      // Backlog: all "new" + "pending" (no date filter)
      const backlogRequests = requestsData.filter((r: Request) =>
        isBacklogStatus(r.status)
      ).length;

      // Ongoing: transmitted to 3D artist (no date filter)
      const ongoingRequests = requestsData.filter(
        (r: Request) => isOngoingStatus(r.status)
      ).length;

      // Requests = backlog + ongoing
      const totalRequests = backlogRequests + ongoingRequests;

      // Sent: sent to client (current week only)
      // Use sentDate if available (date when sent to client), otherwise use date (date received)
      const sentRequests = requestsData.filter((r: Request) => {
        const sentDate = getSentDate(r);
        if (!sentDate) return false;
        return isSentStatus(r.status) && isWithinCurrentWeek(sentDate);
      }).length;

      setStats({
        totalRequests,
        ongoingRequests,
        sentRequests,
        backlogRequests,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
          Semaine en cours: {getCurrentWeekRange()} (pour "Sent this week")
        </div>
      </div>

      <GoogleSheetsSync />
      <CSVMatching />

      <DashboardKPIs stats={stats} />

      <div className="mb-8">
        <ArtistBacklogSummary artists={artists} />
      </div>
    </AdminLayout>
  );
}

