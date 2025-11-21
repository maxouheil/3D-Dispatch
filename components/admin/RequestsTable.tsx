'use client';

import { useState, useEffect } from 'react';
import { Request, Artist } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RequestsTableProps {
  requests: Request[];
  artists: Artist[];
  onAssign?: (requestId: string, artistId: string) => void;
  onStatusChange?: (requestId: string, status: string) => void;
}

export function RequestsTable({
  requests,
  artists,
  onAssign,
  onStatusChange,
}: RequestsTableProps) {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string>('');

  // Récupérer les statuts uniques depuis les requêtes
  const uniqueStatuses = Array.from(
    new Set(
      requests
        .map(req => req.status?.trim())
        .filter((status): status is string => !!status)
    )
  ).sort();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    // Valeur vide = "new" avec style gris
    if (!status || !status.trim()) return 'bg-gray-100 text-gray-700 border-gray-300';
    
    const statusLower = status.toLowerCase().trim();
    
    // Styles pour les statuts standards
    switch (statusLower) {
      case 'new':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'ongoing':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'correction':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'sent':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        // Détecter les variantes communes
        // "sent to client" spécifiquement en vert
        if (statusLower === 'sent to client' || statusLower.includes('sent to client')) {
          return 'bg-green-100 text-green-700 border-green-300';
        }
        // "pending" en orange
        if (statusLower === 'pending' || statusLower.includes('pending')) {
          return 'bg-orange-100 text-orange-700 border-orange-300';
        }
        // Autres variantes de "sent"
        if (statusLower.includes('sent') || statusLower.includes('envoyé')) {
          return 'bg-green-100 text-green-700 border-green-300';
        }
        if (statusLower.includes('ongoing') || statusLower.includes('en cours') || statusLower.includes('in progress')) {
          return 'bg-blue-100 text-blue-700 border-blue-300';
        }
        if (statusLower.includes('correction') || statusLower.includes('retour') || statusLower.includes('revision')) {
          return 'bg-orange-100 text-orange-700 border-orange-300';
        }
        // Transmitted to 3d artist ou variantes
        if (statusLower.includes('transmitted') || statusLower.includes('transmis') || statusLower.includes('to 3d') || statusLower.includes('to artist')) {
          return 'bg-purple-100 text-purple-700 border-purple-300';
        }
        // Par défaut pour les valeurs inconnues
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getArtistName = (artistId: string | null) => {
    if (!artistId) return 'Non assigné';
    const artist = artists.find((a) => a.id === artistId);
    return artist?.name || 'Inconnu';
  };

  const handleAssign = () => {
    if (selectedRequest && selectedArtist && onAssign) {
      onAssign(selectedRequest, selectedArtist);
      setSelectedRequest(null);
      setSelectedArtist('');
    }
  };

  const handleStatusChange = (requestId: string, newStatus: string) => {
    if (onStatusChange) {
      // Si "new" est sélectionné, enregistrer une chaîne vide pour préserver les valeurs brutes
      const statusToSave = newStatus === 'new' ? '' : newStatus;
      onStatusChange(requestId, statusToSave);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Toutes les Requêtes 3D</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">#</th>
                <th className="text-left p-3 font-semibold w-[15%]">Client</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-left p-3 font-semibold w-[20%]">Status</th>
                <th className="text-left p-3 font-semibold">Date</th>
                <th className="text-left p-3 font-semibold">Prix</th>
                <th className="text-left p-3 font-semibold">Assigné à</th>
                <th className="text-left p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">#{request.number}</td>
                  <td className="p-3 w-[15%]">{request.clientName}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        request.type === 'PP'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {request.type}
                    </span>
                  </td>
                  <td className="p-3 w-[20%]">
                    <select
                      value={request.status || ''}
                      onChange={(e) =>
                        handleStatusChange(request.id, e.target.value)
                      }
                      className={`text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusColor(
                        request.status
                      )} w-full`}
                    >
                      <option value="">new</option>
                      {uniqueStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {formatDate(request.date)}
                  </td>
                  <td className="p-3">{request.price}€</td>
                  <td className="p-3">
                    {selectedRequest === request.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedArtist}
                          onChange={(e) => setSelectedArtist(e.target.value)}
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="">Sélectionner...</option>
                          {artists.map((artist) => (
                            <option key={artist.id} value={artist.id}>
                              {artist.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={handleAssign}
                          disabled={!selectedArtist}
                        >
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRequest(null);
                            setSelectedArtist('');
                          }}
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{getArtistName(request.assignedTo)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRequest(request.id)}
                        >
                          Modifier
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {request.status === 'sent' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(request.id, 'correction')
                        }
                      >
                        Renvoyer en correction
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

