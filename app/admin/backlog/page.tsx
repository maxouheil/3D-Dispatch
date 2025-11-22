'use client';

import { useState, useEffect } from 'react';
import { Request, Artist } from '@/lib/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { getArtistFlag } from '@/lib/artist-flags';
import { getCurrentWeekRange } from '@/lib/utils';

export default function BacklogPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async () => {
    try {
      const response = await fetch('/api/artists');
      const artistsData = await response.json();
      setArtists(artistsData);
    } catch (error) {
      console.error('Error fetching artists:', error);
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
        <h1 className="text-3xl font-bold text-gray-900">Backlog</h1>
        <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
          Semaine en cours: {getCurrentWeekRange()}
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <select
          value={selectedArtist}
          onChange={(e) => setSelectedArtist(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Artists</option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name} {getArtistFlag(artist.name)}
            </option>
          ))}
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>Budget</option>
        </select>
      </div>

      <KanbanBoard artistId={selectedArtist} />
    </AdminLayout>
  );
}



