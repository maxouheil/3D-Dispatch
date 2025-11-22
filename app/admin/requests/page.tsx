'use client';

import { useState, useEffect, useMemo } from 'react';
import { Request, Artist } from '@/lib/types';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { formatRequestNumber, formatDateShort } from '@/lib/format-utils';
import { getArtistFlag } from '@/lib/artist-flags';
import { getCurrentWeekRange } from '@/lib/utils';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown } from 'lucide-react';

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [artistFilter, setArtistFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<'number' | 'received' | 'price' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const handleAssign = async (requestId: string, artistId: string) => {
    try {
      await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: artistId }),
      });
      fetchData();
      setSelectedRequest(null);
      setSelectedArtist('');
    } catch (error) {
      console.error('Error assigning request:', error);
    }
  };

  const handleStatusChange = async (requestId: string, status: string) => {
    try {
      // Si "new" est sélectionné, enregistrer une chaîne vide pour préserver les valeurs brutes
      const statusToSave = status === 'new' ? '' : status;
      await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusToSave }),
      });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    // Valeur vide = "new" avec style gris
    if (!status || !status.trim()) return 'bg-gray-100 text-gray-700 border-gray-300';
    
    const statusLower = status.toLowerCase().trim();
    
    // Styles pour les statuts standards
    const styles = {
      new: 'bg-gray-100 text-gray-700 border-gray-300',
      ongoing: 'bg-blue-100 text-blue-700 border-blue-300',
      correction: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      sent: 'bg-green-100 text-green-700 border-green-300',
      transmitted: 'bg-purple-100 text-purple-700 border-purple-300',
      canceled: 'bg-red-100 text-red-700 border-red-300',
      cancelled: 'bg-red-100 text-red-700 border-red-300',
    };
    
    // Si c'est un statut standard, utiliser son style
    if (styles[statusLower as keyof typeof styles]) {
      return styles[statusLower as keyof typeof styles];
    }
    
    // Détecter les variantes communes pour appliquer le bon style
    // "sent to client" spécifiquement en vert
    if (statusLower === 'sent to client' || statusLower.includes('sent to client')) {
      return styles.sent;
    }
    // "pending" en orange
    if (statusLower === 'pending' || statusLower.includes('pending')) {
      return 'bg-orange-100 text-orange-700 border-orange-300';
    }
    // Autres variantes de "sent"
    if (statusLower.includes('sent') || statusLower.includes('envoyé')) {
      return styles.sent;
    }
    if (statusLower.includes('ongoing') || statusLower.includes('en cours') || statusLower.includes('in progress')) {
      return styles.ongoing;
    }
    if (statusLower.includes('correction') || statusLower.includes('retour') || statusLower.includes('revision')) {
      return styles.correction;
    }
    // Transmitted to 3d artist ou variantes
    if (statusLower.includes('transmitted') || statusLower.includes('transmis') || statusLower.includes('to 3d') || statusLower.includes('to artist')) {
      return styles.transmitted;
    }
    // Canceled/Cancelled en rouge
    if (statusLower.includes('cancel') || statusLower.includes('annulé') || statusLower.includes('annule')) {
      return styles.canceled;
    }
    
    // Par défaut, style gris pour les valeurs inconnues
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'new';
    
    // Retourner la valeur brute telle quelle (pas de transformation)
    return status;
  };

  // Récupérer les statuts uniques depuis les requêtes
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    requests.forEach(req => {
      if (req.status && req.status.trim()) {
        statuses.add(req.status.trim());
      }
    });
    return Array.from(statuses).sort();
  }, [requests]);

  const handleSort = (column: 'number' | 'received' | 'price') => {
    if (sortColumn === column) {
      // Inverser la direction si on clique sur la même colonne
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nouvelle colonne, trier par défaut en décroissant
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filtrer les requêtes selon les critères (pas de filtre de semaine)
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Filtre par recherche texte
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          request.clientName?.toLowerCase().includes(query) ||
          request.ppName?.toLowerCase().includes(query) ||
          request.number?.toString().includes(query) ||
          formatRequestNumber(request.number, request.type).toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filtre par statut
      if (statusFilter) {
        const requestStatus = request.status || '';
        if (statusFilter === 'new' && requestStatus.trim() !== '') return false;
        if (statusFilter !== 'new' && requestStatus !== statusFilter) return false;
      }

      // Filtre par artiste assigné
      if (artistFilter) {
        if (artistFilter === 'unassigned' && request.assignedTo !== null) return false;
        if (artistFilter !== 'unassigned' && request.assignedTo !== artistFilter) return false;
      }

      // Filtre par prix
      if (priceFilter) {
        const price = request.price || 0;
        switch (priceFilter) {
          case '0-1000':
            if (price < 0 || price > 1000) return false;
            break;
          case '1000-3000':
            if (price < 1000 || price > 3000) return false;
            break;
          case '3000-5000':
            if (price < 3000 || price > 5000) return false;
            break;
          case '5000+':
            if (price < 5000) return false;
            break;
        }
      }

      return true;
    });
  }, [requests, searchQuery, statusFilter, artistFilter, priceFilter]);

  // Ensuite trier et dédupliquer par ID
  const sortedRequests = useMemo(() => {
    // Dédupliquer les requêtes par ID (garder la première occurrence)
    const uniqueRequests = filteredRequests.reduce((acc, req) => {
      if (!acc.find(r => r.id === req.id)) {
        acc.push(req);
      }
      return acc;
    }, [] as Request[]);

    // Fonction helper pour vérifier si une requête doit être à la fin
    const shouldBeAtEnd = (req: Request): boolean => {
      const statusLower = (req.status || '').toLowerCase().trim();
      const isCancelled = statusLower.includes('cancel') || statusLower.includes('annulé') || statusLower.includes('annule');
      const hasInvalidDate = !req.date || isNaN(new Date(req.date).getTime());
      return isCancelled || hasInvalidDate;
    };

    // Trier
    const sorted = [...uniqueRequests].sort((a, b) => {
      const aAtEnd = shouldBeAtEnd(a);
      const bAtEnd = shouldBeAtEnd(b);
      
      // Si l'une est à la fin et l'autre non, celle à la fin va après
      if (aAtEnd && !bAtEnd) return 1;
      if (!aAtEnd && bAtEnd) return -1;
      
      // Si les deux sont à la fin, les trier entre elles par date (si disponible) ou par numéro
      if (aAtEnd && bAtEnd) {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        if (dateA && dateB) {
          return dateB - dateA; // Plus récent d'abord parmi les cancelled
        }
        return b.number - a.number; // Sinon par numéro décroissant
      }

      // Tri normal pour les requêtes non-cancelled avec date valide
      if (!sortColumn) {
        // Par défaut, trier par date (plus récent d'abord)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      }

      let comparison = 0;
      
      if (sortColumn === 'number') {
        comparison = a.number - b.number;
      } else if (sortColumn === 'received') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        comparison = dateA - dateB;
      } else if (sortColumn === 'price') {
        comparison = a.price - b.price;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredRequests, sortColumn, sortDirection]);

  const getSortIcon = (column: 'number' | 'received' | 'price') => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-gray-700" />
      : <ArrowDown className="w-4 h-4 text-gray-700" />;
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
        <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
        <div className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
          Semaine en cours: {getCurrentWeekRange()} (pour "Sent this week")
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Contact (mail, nom, prénom..)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3">
          {/* Filtre Artiste */}
          <div className="relative inline-block">
            <select
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer min-w-[140px] relative z-10"
              style={{ color: artistFilter ? 'transparent' : 'inherit' }}
            >
              <option value="">To assign</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
            {artistFilter && (
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none z-0 flex items-center gap-1 text-sm">
                {(() => {
                  const selected = artists.find(a => a.id === artistFilter);
                  return selected ? (
                    <>
                      {selected.name} {getArtistFlag(selected.name)}
                    </>
                  ) : null;
                })()}
              </div>
            )}
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
          </div>

          {/* Filtre Status */}
          <div className="relative inline-block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer min-w-[120px]"
            >
              <option value="">Status</option>
              <option value="new">new</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Filtre Prix */}
          <div className="relative inline-block">
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
              className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer min-w-[120px]"
            >
              <option value="">Budget</option>
              <option value="0-1000">0 - 1 000 €</option>
              <option value="1000-3000">1 000 - 3 000 €</option>
              <option value="3000-5000">3 000 - 5 000 €</option>
              <option value="5000+">5 000 € +</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th 
                className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('number')}
              >
                <div className="flex items-center gap-2">
                  Request #
                  {getSortIcon('number')}
                </div>
              </th>
              <th className="text-left p-3 font-semibold text-gray-700 w-[15%]">Name</th>
              <th className="text-left p-3 font-semibold text-gray-700">PP</th>
              <th className="text-left p-3 font-semibold text-gray-700 w-[20%]">Status</th>
              <th 
                className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('received')}
              >
                <div className="flex items-center gap-2">
                  Received
                  {getSortIcon('received')}
                </div>
              </th>
              <th 
                className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center gap-2">
                  Prix
                  {getSortIcon('price')}
                </div>
              </th>
              <th className="text-left p-3 font-semibold text-gray-700">Assign to</th>
            </tr>
          </thead>
          <tbody>
            {sortedRequests.map((request) => {
              const assignedArtist = request.assignedTo
                ? artists.find((a) => a.id === request.assignedTo)
                : null;
              const isEditing = selectedRequest === request.id;

              return (
                <tr key={request.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <span className="text-blue-600 mr-1">•</span>
                    {formatRequestNumber(request.number, request.type)}
                  </td>
                  <td className="p-3 font-medium text-gray-900 w-[15%]">{request.clientName}</td>
                  <td className="p-3 text-gray-600">{request.type === 'PP' ? (request.ppName || 'PP') : '-'}</td>
                  <td className="p-3 w-[20%]">
                    <select
                      value={request.status || ''}
                      onChange={(e) => handleStatusChange(request.id, e.target.value)}
                      className={`text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusBadge(
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
                  <td className="p-3 text-gray-600">{formatDateShort(request.date)}</td>
                  <td className="p-3 text-gray-900">{request.price} €</td>
                  <td className="p-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedArtist}
                          onChange={(e) => setSelectedArtist(e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">To assign</option>
                          {artists.map((artist) => (
                            <option key={artist.id} value={artist.id}>
                              {artist.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (selectedArtist) {
                              handleAssign(request.id, selectedArtist);
                            }
                          }}
                          disabled={!selectedArtist}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequest(null);
                            setSelectedArtist('');
                          }}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedRequest(request.id)}
                        className="flex items-center gap-2 px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                      >
                        {assignedArtist ? (
                          <>
                            {assignedArtist.name} {getArtistFlag(assignedArtist.name)}
                          </>
                        ) : (
                          'To assign'
                        )}
                        <span className="text-gray-400">▼</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

