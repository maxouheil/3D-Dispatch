'use client';

import { Request } from '@/lib/types';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatRequestNumber } from '@/lib/format-utils';

interface KanbanCardProps {
  request: Request;
}

export function KanbanCard({ request }: KanbanCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: request.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    router.push(`/request/${request.id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="cursor-pointer hover:shadow-md transition-shadow p-4 mb-3 bg-white rounded-lg"
    >
      <div className="relative">
        <div className="absolute top-0 right-0 w-16 h-16 rounded overflow-hidden bg-gray-100">
          <Image
            src={request.thumbnail || '/thumbnails/ikea-1.jpg'}
            alt={request.design}
            fill
            className="object-cover"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="10"%3EIKP%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>
        <div className="pr-20">
          <h3 className="font-medium text-sm text-gray-900 mb-1">
            {request.clientName}
          </h3>
          <p className="text-xs text-gray-600 mb-2">
            {formatRequestNumber(request.number, request.type)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Client</span>
            <span>{formatDate(request.date)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

