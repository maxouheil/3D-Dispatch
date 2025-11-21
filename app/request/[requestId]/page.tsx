'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Request } from '@/lib/types';
import { RequestDetails } from '@/components/request/RequestDetails';
import { RenderUpload } from '@/components/request/RenderUpload';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      const response = await fetch(`/api/requests/${requestId}`);
      if (response.ok) {
        const data = await response.json();
        setRequest(data);
      }
    } catch (error) {
      console.error('Error fetching request:', error);
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

  if (!request) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Requête non trouvée</h1>
          <Button onClick={() => router.back()}>Retour</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      <RequestDetails request={request} />

      <div className="mt-6">
        <RenderUpload
          requestId={request.id}
          renders={request.renders}
          onUploadComplete={fetchRequest}
        />
      </div>
    </div>
  );
}

