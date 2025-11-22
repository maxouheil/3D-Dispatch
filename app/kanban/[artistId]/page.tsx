'use client';

import { useParams } from 'next/navigation';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useState, useEffect } from 'react';
import { Artist } from '@/lib/types';

export default function KanbanPage() {
  const params = useParams();
  const artistId = params.artistId as string;
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtist();
  }, [artistId]);

  const fetchArtist = async () => {
    try {
      const response = await fetch('/api/artists');
      const artists = await response.json();
      const foundArtist = artists.find((a: Artist) => a.id === artistId);
      setArtist(foundArtist || null);
    } catch (error) {
      console.error('Error fetching artist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Artiste non trouvé</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Backlog - {artist.name}</h1>
        <p className="text-gray-600">
          Gérez vos requêtes en les déplaçant entre les colonnes
        </p>
      </div>
      <KanbanBoard artistId={artistId} />
    </div>
  );
}



