'use client';

import { useState, useEffect } from 'react';
import { Request, Artist } from '@/lib/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { getArtistFlag } from '@/lib/artist-flags';

export default function BacklogPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>('1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async () => {
    try {
      const response = await fetch('/api/artists');
      const artistsData = await response.json();
      setArtists(artistsData);
      if (artistsData.length > 0 && !selectedArtist) {
        setSelectedArtist(artistsData[0].id);
      }
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
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Backlog</h1>

      <div className="mb-6 flex gap-4">
        <select
          value={selectedArtist}
          onChange={(e) => setSelectedArtist(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
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

