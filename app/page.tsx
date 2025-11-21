'use client';

import { useState, useEffect } from 'react';
import { Request, Artist, DashboardStats } from '@/lib/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DashboardKPIs } from '@/components/admin/DashboardKPIs';
import { ArtistBacklogSummary } from '@/components/admin/ArtistBacklogSummary';
import { GoogleSheetsSync } from '@/components/admin/GoogleSheetsSync';

export default function HomePage() {
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

      // Calculate stats
      const totalRequests = requestsData.length;
      const ongoingRequests = requestsData.filter(
        (r: Request) => r.status === 'ongoing'
      ).length;
      const sentRequests = requestsData.filter(
        (r: Request) => r.status === 'sent'
      ).length;
      const backlogRequests = requestsData.filter(
        (r: Request) => r.status === 'new'
      ).length;

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
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Admin</h1>

      <GoogleSheetsSync />

      <DashboardKPIs stats={stats} />

      <div className="mb-8">
        <ArtistBacklogSummary artists={artists} />
      </div>
    </AdminLayout>
  );
}

