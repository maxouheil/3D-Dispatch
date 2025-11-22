'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Request, RequestStatus, Artist } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { isWithinCurrentWeek, isSentStatus, isBacklogStatus } from '@/lib/utils';

interface KanbanBoardProps {
  artistId: string;
}

// Fonction pour obtenir la configuration d'un statut (couleur et titre)
function getStatusConfig(status: string): { title: string; color: string } {
  const statusLower = status.toLowerCase().trim();
  
  // Statut vide = "NEW REQUEST"
  if (!status || status === '') {
    return { title: 'NEW REQUEST', color: 'bg-gray-600' };
  }
  
  // Mapping des statuts connus
  const knownStatuses: Record<string, { title: string; color: string }> = {
    'pending': { title: 'PENDING', color: 'bg-orange-600' },
    'transmitted to 3d artist': { title: 'TRANSMITTED TO 3D ARTIST', color: 'bg-blue-600' },
    'sent to client': { title: 'SENT TO CLIENT (THIS WEEK)', color: 'bg-green-600' },
    'cancelled': { title: 'CANCELLED', color: 'bg-red-600' },
    'canceled': { title: 'CANCELLED', color: 'bg-red-600' },
    'exchange with user': { title: 'EXCHANGE WITH USER', color: 'bg-yellow-600' },
    'correction': { title: 'CORRECTION REQUEST', color: 'bg-orange-600' },
    'correction request': { title: 'CORRECTION REQUEST', color: 'bg-orange-600' },
  };
  
  // Vérifier si c'est un statut connu
  if (knownStatuses[statusLower]) {
    return knownStatuses[statusLower];
  }
  
  // Détection par mots-clés pour les variantes
  if (statusLower.includes('transmitted') || statusLower.includes('transmis')) {
    return { title: status.toUpperCase(), color: 'bg-blue-600' };
  }
  if (statusLower.includes('sent') || statusLower.includes('envoyé')) {
    // Si c'est "sent to client", ajouter "(THIS WEEK)" au titre
    if (statusLower.includes('sent to client') || statusLower === 'sent to client') {
      return { title: `${status.toUpperCase()} (THIS WEEK)`, color: 'bg-green-600' };
    }
    return { title: status.toUpperCase(), color: 'bg-green-600' };
  }
  if (statusLower.includes('pending') || statusLower.includes('en attente')) {
    return { title: status.toUpperCase(), color: 'bg-orange-600' };
  }
  if (statusLower.includes('cancel')) {
    return { title: status.toUpperCase(), color: 'bg-red-600' };
  }
  if (statusLower.includes('correction') || statusLower.includes('retour')) {
    return { title: status.toUpperCase(), color: 'bg-orange-600' };
  }
  
  // Par défaut, utiliser le statut tel quel avec une couleur neutre
  return { title: status.toUpperCase(), color: 'bg-gray-600' };
}

export function KanbanBoard({ artistId }: KanbanBoardProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchArtists();
    fetchRequests();
  }, [artistId]);

  const fetchArtists = async () => {
    try {
      const response = await fetch('/api/artists');
      const data = await response.json();
      setArtists(data || []);
    } catch (error) {
      console.error('Error fetching artists:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      if (artistId === 'all') {
        // Fetch all requests for all artists
        const response = await fetch('/api/artists/all/backlog');
        const data = await response.json();
        setRequests(data.requests || []);
      } else {
        const response = await fetch(`/api/artists/${artistId}/backlog`);
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArtistChange = async (requestId: string, newArtistId: string | null) => {
    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, assignedTo: newArtistId } : r
      )
    );
    
    // Refresh requests to get updated data
    await fetchRequests();
  };

  // Détecter tous les statuts uniques présents dans les données (exclure Cancelled)
  const uniqueStatuses = useMemo(() => {
    const statusSet = new Set<string>();
    requests.forEach((r) => {
      // Traiter les statuts vides comme ""
      const status = r.status || '';
      // Exclure "Cancelled" et "Canceled"
      const statusLower = status.toLowerCase().trim();
      if (statusLower !== 'cancelled' && statusLower !== 'canceled') {
        statusSet.add(status);
      }
    });
    
    // Trier les statuts pour un ordre cohérent
    // Priorité: backlog -> transmitted -> sent -> autres
    const statusArray = Array.from(statusSet);
    const statusOrder: Record<string, number> = {
      '': 0,
      'Pending': 0, // Même priorité que '' car ils seront dans Backlog
      'Transmitted to 3D artist': 1,
      'Sent to client': 2,
      'Exchange with user': 3,
    };
    
    return statusArray.sort((a, b) => {
      const orderA = statusOrder[a] ?? 999;
      const orderB = statusOrder[b] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  }, [requests]);

  // Définir tous les statuts possibles à afficher (toujours afficher toutes les colonnes)
  const allPossibleStatuses = useMemo(() => {
    const standardStatuses = [
      'Transmitted to 3D artist',
      'Sent to client',
      'Exchange with user',
    ];
    
    // Combiner les statuts standards avec les statuts uniques trouvés dans les données
    const statusSet = new Set<string>();
    
    // Ajouter les statuts standards
    standardStatuses.forEach(s => statusSet.add(s));
    
    // Ajouter les statuts uniques trouvés (exclure "" et "Pending" car ils sont dans Backlog)
    uniqueStatuses.forEach(s => {
      if (s !== '' && s !== 'Pending') {
        statusSet.add(s);
      }
    });
    
    // Trier pour un ordre cohérent
    const statusArray = Array.from(statusSet);
    const statusOrder: Record<string, number> = {
      'Transmitted to 3D artist': 1,
      'Sent to client': 2,
      'Exchange with user': 3,
    };
    
    return statusArray.sort((a, b) => {
      const orderA = statusOrder[a] ?? 999;
      const orderB = statusOrder[b] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  }, [uniqueStatuses]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const requestId = active.id as string;
    const newStatus = over.id as string;

    const request = requests.find((r) => r.id === requestId);
    if (!request) return;
    
    // Gérer le cas spécial "backlog" : mettre "Pending" par défaut
    let normalizedNewStatus: string;
    if (newStatus === 'backlog') {
      normalizedNewStatus = 'Pending';
    } else if (newStatus === 'new') {
      normalizedNewStatus = '';
    } else {
      normalizedNewStatus = newStatus;
    }
    
    const normalizedCurrentStatus = request.status || '';
    
    if (normalizedCurrentStatus === normalizedNewStatus) return;

    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: normalizedNewStatus } : r
      )
    );

    // Update on server
    try {
      await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizedNewStatus }),
      });
    } catch (error) {
      console.error('Error updating request:', error);
      // Revert on error
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: request.status } : r
        )
      );
    }
  };

  const getRequestsByStatus = (status: string) => {
    // Cas spécial "backlog" : combine new (vide) + Pending
    if (status === 'backlog') {
      return requests.filter((r) => isBacklogStatus(r.status || ''));
    }
    
    // Normaliser: "" correspond à "new" ou statut vide
    if (status === '' || status === 'new') {
      return requests.filter((r) => !r.status || r.status.trim() === '');
    }
    
    // Pour "Sent to client", filtrer uniquement celles de la semaine en cours
    if (isSentStatus(status)) {
      return requests.filter(
        (r) => 
          (r.status || '') === status &&
          r.date &&
          isWithinCurrentWeek(r.date)
      );
    }
    
    // Pour les autres statuts, retourner toutes les requêtes avec ce statut
    return requests.filter((r) => (r.status || '') === status);
  };

  const activeRequest = activeId
    ? requests.find((r) => r.id === activeId)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Colonne Backlog (toujours affichée) */}
        <KanbanColumn
          key="backlog"
          status="backlog"
          requests={getRequestsByStatus('backlog')}
          title="BACKLOG"
          color="bg-gray-600"
          artists={artists}
          onArtistChange={handleArtistChange}
        />
        {/* Autres colonnes */}
        {allPossibleStatuses.map((status) => {
          const config = getStatusConfig(status);
          return (
            <KanbanColumn
              key={status}
              status={status}
              requests={getRequestsByStatus(status)}
              title={config.title}
              color={config.color}
              artists={artists}
              onArtistChange={handleArtistChange}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeRequest ? (
          <KanbanCard 
            request={activeRequest} 
            artists={artists}
            onArtistChange={handleArtistChange}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

