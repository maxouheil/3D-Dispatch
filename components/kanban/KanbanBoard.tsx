'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Request, RequestStatus } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  artistId: string;
}

const statusConfig: Record<RequestStatus, { title: string; color: string }> = {
  new: { title: 'NEW REQUEST', color: 'bg-gray-600' },
  ongoing: { title: 'ONGOING', color: 'bg-blue-600' },
  correction: { title: 'CORRECTION REQUEST', color: 'bg-orange-600' },
  sent: { title: 'SENT', color: 'bg-green-600' },
};

export function KanbanBoard({ artistId }: KanbanBoardProps) {
  const [requests, setRequests] = useState<Request[]>([]);
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
    fetchRequests();
  }, [artistId]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/artists/${artistId}/backlog`);
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const requestId = active.id as string;
    const newStatus = over.id as RequestStatus;

    const request = requests.find((r) => r.id === requestId);
    if (!request || request.status === newStatus) return;

    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: newStatus } : r
      )
    );

    // Update on server
    try {
      await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
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

  const getRequestsByStatus = (status: RequestStatus) => {
    return requests.filter((r) => r.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const activeRequest = activeId
    ? requests.find((r) => r.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {(Object.keys(statusConfig) as RequestStatus[]).map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            requests={getRequestsByStatus(status)}
            title={statusConfig[status].title}
            color={statusConfig[status].color}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRequest ? <KanbanCard request={activeRequest} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

