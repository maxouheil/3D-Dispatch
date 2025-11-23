'use client';

import { Request, Artist } from '@/lib/types';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatRequestNumber, formatPrice } from '@/lib/format-utils';
import { getArtistFlag } from '@/lib/artist-flags';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface KanbanCardProps {
  request: Request;
  artists?: Artist[];
  onArtistChange?: (requestId: string, artistId: string | null) => void;
}

export function KanbanCard({ request, artists = [], onArtistChange }: KanbanCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [artistsList, setArtistsList] = useState<Artist[]>(artists);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: request.id });

  useEffect(() => {
    if (artists.length === 0) {
      // Fetch artists if not provided
      fetch('/api/artists')
        .then(res => res.json())
        .then(data => setArtistsList(data))
        .catch(err => console.error('Error fetching artists:', err));
    } else {
      setArtistsList(artists);
    }
  }, [artists]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown or artist tag
    if ((e.target as HTMLElement).closest('.artist-selector') || 
        (e.target as HTMLElement).closest('.dropdown-menu')) {
      return;
    }
    router.push(`/request/${request.id}`);
  };

  const handleArtistChange = async (artistId: string | null) => {
    try {
      await fetch(`/api/requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: artistId }),
      });
      
      if (onArtistChange) {
        onArtistChange(request.id, artistId);
      }
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error updating artist assignment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${day} ${month}`;
  };

  const getArtist = (artistId: string | null) => {
    if (!artistId) return null;
    return artistsList.find(a => a.id === artistId) || null;
  };

  const assignedArtist = getArtist(request.assignedTo);
  const artistFlag = assignedArtist ? getArtistFlag(assignedArtist.name) : null;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 bg-white rounded-xl border border-gray-200 overflow-hidden mb-3"
    >
      {/* Top Section: Name, ID, Date, and Thumbnail */}
      <div className="relative p-5 pb-4">
        {/* Thumbnail - Top Right */}
        <div className="absolute top-5 right-5 w-11 h-11 rounded-lg overflow-hidden bg-gray-100 shadow-sm border border-gray-200">
          {imageError ? (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-xs font-medium">IKP</span>
            </div>
          ) : (
            <Image
              src={request.thumbnail || '/thumbnails/ikea-1.jpg'}
              alt={request.design}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* Name and ID+Date - Top Left */}
        <div className="pr-20">
          <h3 className="font-semibold text-sm text-gray-900 mb-1 leading-tight">
            {request.clientName}
          </h3>
          <p className="text-sm text-gray-500 font-medium">
            {formatRequestNumber(request.number, request.type)} · {formatDate(request.date)}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200 mx-5"></div>

      {/* Bottom Section: Artist Tag and Price */}
      <div className="p-5 pt-4 flex items-center justify-between">
        {/* Artist Tag */}
        <div 
          ref={dropdownRef}
          className="relative artist-selector" 
          onClick={(e) => e.stopPropagation()}
        >
          {assignedArtist ? (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-900 border border-gray-200"
            >
              <span>{assignedArtist.name}</span>
              {artistFlag && (
                <span className="text-base leading-none">{artistFlag}</span>
              )}
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
          ) : (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-500 border border-gray-200"
            >
              <span>Non assigné</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
          )}

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div 
              className="dropdown-menu absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleArtistChange(null)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Non assigné
              </button>
              {artistsList.map((artist) => {
                const flag = getArtistFlag(artist.name);
                return (
                  <button
                    key={artist.id}
                    onClick={() => handleArtistChange(artist.id)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <span>{artist.name}</span>
                    {flag && <span className="text-base leading-none">{flag}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Price */}
        {request.price !== undefined && request.price !== null && request.price > 0 && (
          <div className="text-sm text-gray-900 font-medium">
            {formatPrice(request.price)}
          </div>
        )}
      </div>
    </Card>
  );
}

