'use client';

import { useState, useEffect } from 'react';
import { Request, Artist } from '@/lib/types';
import { AutoDispatchConfig } from '@/components/dispatch/AutoDispatchConfig';
import { RequestsTable } from '@/components/admin/RequestsTable';
import { autoDispatchRequests } from '@/lib/dispatch-algorithm';

export default function DispatchPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDispatch = async () => {
    try {
      const unassignedRequests = requests.filter(
        (r) => r.status === 'new' && !r.assignedTo
      );

      if (unassignedRequests.length === 0) {
        alert('Aucune requête non assignée à dispatcher');
        return;
      }

      const updatedRequests = autoDispatchRequests(requests, artists);

      // Update all requests
      for (const request of updatedRequests) {
        const original = requests.find((r) => r.id === request.id);
        if (original && request.assignedTo !== original.assignedTo) {
          await fetch(`/api/requests/${request.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedTo: request.assignedTo }),
          });
        }
      }

      alert('Dispatch automatique terminé!');
      fetchData();
    } catch (error) {
      console.error('Error performing auto dispatch:', error);
      alert('Erreur lors du dispatch automatique');
    }
  };

  const handleAssign = async (requestId: string, artistId: string) => {
    try {
      await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: artistId }),
      });
      fetchData();
    } catch (error) {
      console.error('Error assigning request:', error);
    }
  };

  const handleStatusChange = async (requestId: string, status: string) => {
    try {
      await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dispatch de Requêtes</h1>

      <div className="mb-8">
        <AutoDispatchConfig onDispatch={handleAutoDispatch} />
      </div>

      <RequestsTable
        requests={requests}
        artists={artists}
        onAssign={handleAssign}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

