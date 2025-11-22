'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Request } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical, Upload, Send, User, Briefcase, Calendar, Paperclip, Image as ImageIcon } from 'lucide-react';
import { CSVRequestData } from '@/lib/csv-request-parser';
import { formatRequestNumber } from '@/lib/format-utils';
import { Sidebar } from '@/components/layout/Sidebar';
import Image from 'next/image';

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.requestId as string;
  const [request, setRequest] = useState<Request | null>(null);
  const [csvData, setCsvData] = useState<CSVRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  useEffect(() => {
    if (request) {
      fetchCSVData();
    }
  }, [request]);

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

  const fetchCSVData = async () => {
    if (!request?.projectCode) {
      setCsvLoading(false);
      return;
    }

    try {
      setCsvError(null);
      const response = await fetch(`/api/requests/${requestId}/csv-data`);
      if (response.ok) {
        const data = await response.json();
        setCsvData(data);
      } else {
        const errorData = await response.json();
        setCsvError(errorData.message || 'Erreur lors de la récupération des données CSV');
      }
    } catch (error) {
      console.error('Error fetching CSV data:', error);
      setCsvError('Erreur lors de la récupération des données CSV');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // TODO: Handle file upload
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Requête non trouvée</h1>
          <Button onClick={() => router.back()}>Retour</Button>
        </div>
      </div>
    );
  }

  const requestNumber = formatRequestNumber(request.number, request.type);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Navigation */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold">{requestNumber}</h1>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                IKEA PLAN
              </span>
            </div>
            <Button variant="ghost" size="sm" className="p-2">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
          <div className="mt-4">
            <Button className="bg-green-500 hover:bg-green-600 text-white border-green-500">
              NEW REQUEST
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Middle Section - Request Details */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {csvData ? (
              <div className="space-y-6">
                {/* BOTTOM Section */}
                {csvData.data && Object.keys(csvData.data).length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">BOTTOM</h2>
                    <div className="space-y-2.5">
                      {csvData.headers.map((header, idx) => {
                        const value = csvData.data[header];
                        if (!value || value.trim() === '') return null;
                        
                        // Pour PP, afficher toutes les colonnes extraites
                        // Les premières colonnes correspondent à BOTTOM
                        if (csvData.type === 'PP' && !csvData.isBicolor) {
                          // Monochrome: B, D, E, F puis Z à AG
                          if (idx < csvData.headers.length) {
                            return (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                                <span className="text-sm text-gray-900">{value}</span>
                              </div>
                            );
                          }
                        } else if (csvData.type === 'PP' && csvData.isBicolor) {
                          // Bicolor: B puis G à AG
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                              <span className="text-sm text-gray-900">{value}</span>
                            </div>
                          );
                        } else if (csvData.type === 'Client') {
                          // Client: B à K
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                              <span className="text-sm text-gray-900">{value}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* TOP Section - Only for Bicolor PP */}
                {csvData.isBicolor && csvData.type === 'PP' && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">TOP</h2>
                    <div className="space-y-2.5">
                      {/* Les colonnes G à AG pour TOP dans bicolor */}
                      {csvData.headers.slice(1).map((header, idx) => {
                        const value = csvData.data[header];
                        if (!value || value.trim() === '') return null;
                        return (
                          <div key={`top-${idx}`} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                            <span className="text-sm text-gray-900">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* COLUMN Section */}
                <div className="mt-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">COLUMN</h2>
                  <div className="space-y-2.5">
                    {/* Afficher les dernières colonnes pour COLUMN */}
                    {csvData.headers.slice(-3).map((header, idx) => {
                      const value = csvData.data[header];
                      if (!value || value.trim() === '') return null;
                      return (
                        <div key={`col-${idx}`} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                          <span className="text-sm text-gray-900">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DESCRIPTION */}
                {(request.description || csvData.data['Description']) && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">DESCRIPTION</h2>
                    <p className="text-sm text-gray-900">
                      {request.description || csvData.data['Description'] || csvData.data['DESCRIPTION']}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                {csvLoading ? (
                  <p>Chargement des données CSV...</p>
                ) : csvError ? (
                  <p className="text-red-600">{csvError}</p>
                ) : (
                  <p>Aucune donnée CSV disponible</p>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Image Upload Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-1">Drag images here</p>
                <p className="text-xs text-gray-500">
                  Attach as many images as you need. Should not exceed 10Mb
                </p>
              </div>

              {/* SEND Button */}
              <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white">
                <Send className="w-4 h-4 mr-2" />
                SEND
              </Button>

              {/* 3D Render Preview */}
              {request.renders && request.renders.length > 0 ? (
                <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={request.renders[0].url}
                    alt="3D Render"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No render available</span>
                </div>
              )}

              {/* Project Metadata */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">
                    {csvData?.data[csvData.headers[0]] || request.clientName || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">Metod</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">
                    {request.date
                      ? new Date(request.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Paperclip className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">Attached files</span>
                </div>

                {/* Attached Files Thumbnails */}
                {request.renders && request.renders.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {request.renders.slice(0, 2).map((render) => (
                      <div
                        key={render.id}
                        className="relative aspect-square bg-gray-100 rounded overflow-hidden"
                      >
                        <Image
                          src={render.url}
                          alt={render.filename}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
