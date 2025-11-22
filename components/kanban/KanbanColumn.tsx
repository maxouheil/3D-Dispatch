'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Request, RequestStatus, Artist } from '@/lib/types';
import { KanbanCard } from './KanbanCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: RequestStatus;
  requests: Request[];
  title: string;
  color: string;
  artists?: Artist[];
  onArtistChange?: (requestId: string, artistId: string | null) => void;
}

export function KanbanColumn({
  status,
  requests,
  title,
  color,
  artists,
  onArtistChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-1 min-w-[280px]">
      <div className="bg-gray-200 p-3 mb-3 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-700 uppercase">
          {title} · {requests.length}
        </h3>
      </div>
      <SortableContext
        items={requests.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            'min-h-[400px] rounded-b-lg p-3 transition-colors bg-white',
            isOver ? 'bg-blue-50' : ''
          )}
        >
          {requests.map((request) => (
            <KanbanCard 
              key={request.id} 
              request={request}
              artists={artists}
              onArtistChange={onArtistChange}
            />
          ))}
          {requests.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              Aucune requête
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

