'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Request } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical, Upload, Send, User, Briefcase, Calendar, Paperclip, Image as ImageIcon } from 'lucide-react';
import { CSVRequestData } from '@/lib/csv-request-parser';
import { formatRequestNumber, formatPrice } from '@/lib/format-utils';
import { Sidebar } from '@/components/layout/Sidebar';
import Image from 'next/image';

// Helper function to extract section data from CSV based on column indices
function extractSectionFromCSV(
  csvData: CSVRequestData,
  section: 'bottom' | 'top' | 'column'
): { design?: string; color?: string; handle?: string; worktop?: string; backsplash?: string; tap?: string } {
  if (!csvData || !csvData.data || !csvData.headers) {
    return {};
  }

  const data = csvData.data;
  const headers = csvData.headers;
  const columnIndices = csvData.columnIndices || [];
  const result: any = {};

  // Helper pour obtenir la valeur d'une colonne par son index dans le CSV original
  // Les columnIndices contiennent les indices des colonnes extraites dans l'ordre
  // Par exemple pour bicolor: [1, 6, 7, 8, ...] signifie que headers[0] = colonne B, headers[1] = colonne G, etc.
  const getValueByColumnIndex = (targetIndex: number): string | undefined => {
    // targetIndex est l'index dans le CSV original (0-based, G=6, H=7, etc.)
    // On doit trouver dans columnIndices à quelle position se trouve cet index
    const extractedIndex = columnIndices.indexOf(targetIndex);
    if (extractedIndex >= 0 && extractedIndex < headers.length) {
      const header = headers[extractedIndex];
      const value = data[header]?.trim();
      if (value && value !== '') {
        return value;
      }
    }
    return undefined;
  };

  // Helper pour obtenir toutes les valeurs d'une plage de colonnes
  const getValuesByColumnRange = (startIndex: number, endIndex: number): string[] => {
    const values: string[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const value = getValueByColumnIndex(i);
      if (value) values.push(value);
    }
    return values;
  };

  if (section === 'top') {
    // HAUT: Colonnes G, H, I (indices 6, 7, 8)
    const hautValues = getValuesByColumnRange(6, 8);
    if (hautValues.length > 0) {
      result.design = hautValues[0] || undefined;
      result.color = hautValues[1] || undefined;
      result.handle = hautValues[2] || undefined;
    }
  } else if (section === 'column') {
    // COLONNE: Colonnes J, K, L (indices 9, 10, 11)
    const colonneValues = getValuesByColumnRange(9, 11);
    if (colonneValues.length > 0) {
      result.design = colonneValues[0] || undefined;
      result.color = colonneValues[1] || undefined;
      result.handle = colonneValues[2] || undefined;
    }
  } else if (section === 'bottom') {
    // BAS: Colonnes M, N, O, P (indices 12, 13, 14, 15)
    const basValues = getValuesByColumnRange(12, 15);
    if (basValues.length > 0) {
      result.design = basValues[0] || undefined;
      result.color = basValues[1] || undefined;
      result.handle = basValues[2] || undefined;
      result.worktop = basValues[3] || undefined;
      // Chercher crédence et mitigeur dans les valeurs suivantes ou dans d'autres colonnes
      result.backsplash = basValues.find(v => v.toLowerCase().includes('credence') || v.toLowerCase().includes('crédence')) || undefined;
      result.tap = basValues.find(v => v.toLowerCase().includes('mitigeur') || v.toLowerCase().includes('wave') || v.toLowerCase().includes('robinet')) || undefined;
    }
  }

  // Clean up undefined values
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) delete result[key];
  });

  return result;
}

// Helper function to extract ILOT section (colonnes Q, R, S, T)
function extractIlotFromCSV(csvData: CSVRequestData): { design?: string; color?: string; handle?: string; worktop?: string } {
  if (!csvData || !csvData.data || !csvData.headers) {
    return {};
  }

  const data = csvData.data;
  const headers = csvData.headers;
  const columnIndices = csvData.columnIndices || [];
  const result: any = {};

  const getValueByColumnIndex = (targetIndex: number): string | undefined => {
    const extractedIndex = columnIndices.indexOf(targetIndex);
    if (extractedIndex >= 0 && extractedIndex < headers.length) {
      const header = headers[extractedIndex];
      const value = data[header]?.trim();
      if (value) return value;
    }
    return undefined;
  };

  // ILOT: Colonnes Q, R, S, T (indices 16, 17, 18, 19)
  const ilotValues: (string | undefined)[] = [];
  for (let i = 16; i <= 19; i++) {
    ilotValues.push(getValueByColumnIndex(i));
  }

  if (ilotValues.some(v => v)) {
    result.design = ilotValues[0] || undefined;
    result.color = ilotValues[1] || undefined;
    result.handle = ilotValues[2] || undefined;
    result.worktop = ilotValues[3] || undefined;
  }

  // Clean up undefined values
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) delete result[key];
  });

  return result;
}

// Helper to render a section item with swatch
function renderSectionItem(label: string, value: string | undefined) {
  if (!value) return null;
  
  return (
    <div key={label} className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
      <span className="text-sm text-gray-900">{label}: {value}</span>
    </div>
  );
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    if (request) {
      fetchCSVData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                {/* Extract sections from CSV - Détecter automatiquement si bicolor en vérifiant les données */}
                {(() => {
                  // Détecter si c'est bicolor en vérifiant si des données existent dans les colonnes spécifiques
                  const hasBicolorData = (() => {
                    for (let i = 6; i <= 19; i++) {
                      const extractedIndex = csvData.columnIndices?.indexOf(i);
                      if (extractedIndex >= 0 && extractedIndex < csvData.headers.length) {
                        const header = csvData.headers[extractedIndex];
                        const value = csvData.data[header]?.trim();
                        if (value && value !== '') return true;
                      }
                    }
                    return false;
                  })();
                  
                  // Utiliser isBicolor du CSV ou la détection automatique
                  const shouldShowSections = csvData.isBicolor || hasBicolorData;
                  
                  if (shouldShowSections) {
                    const topSection = extractSectionFromCSV(csvData, 'top');
                    const colonneSection = extractSectionFromCSV(csvData, 'column');
                    const bottomSection = extractSectionFromCSV(csvData, 'bottom');
                    const ilotSection = extractIlotFromCSV(csvData);
                    
                    // Vérifier si une section a des données
                    const hasSectionData = (section: any) => {
                      return !!(section.design || section.color || section.handle || section.worktop || section.backsplash || section.tap);
                    };
                    
                    return (
                      <>
                        {/* HAUT Section - Caissons haut */}
                        {hasSectionData(topSection) && (
                          <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">HAUT</h2>
                            <div className="space-y-2.5">
                              {topSection.design && renderSectionItem('Design', topSection.design)}
                              {topSection.color && renderSectionItem('Couleur', topSection.color)}
                              {topSection.handle && renderSectionItem('Poignées', topSection.handle)}
                            </div>
                          </div>
                        )}

                        {/* BAS Section - Caissons bas */}
                        {hasSectionData(bottomSection) && (
                          <div className="mt-6">
                            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">BAS</h2>
                            <div className="space-y-2.5">
                              {bottomSection.design && renderSectionItem('Design', bottomSection.design)}
                              {bottomSection.color && renderSectionItem('Couleur', bottomSection.color)}
                              {bottomSection.handle && renderSectionItem('Poignées', bottomSection.handle)}
                              {bottomSection.worktop && renderSectionItem('Plan de travail', bottomSection.worktop)}
                              {bottomSection.backsplash && renderSectionItem('Crédence', bottomSection.backsplash)}
                              {bottomSection.tap && renderSectionItem('Mitigeur', bottomSection.tap)}
                            </div>
                          </div>
                        )}

                        {/* COLONNE Section - Colonnes */}
                        {hasSectionData(colonneSection) && (
                          <div className="mt-6">
                            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">COLONNE</h2>
                            <div className="space-y-2.5">
                              {colonneSection.design && renderSectionItem('Design', colonneSection.design)}
                              {colonneSection.color && renderSectionItem('Couleur', colonneSection.color)}
                              {colonneSection.handle && renderSectionItem('Poignées', colonneSection.handle)}
                            </div>
                          </div>
                        )}

                        {/* ILOT Section - Ilot */}
                        {hasSectionData(ilotSection) && (
                          <div className="mt-6">
                            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">ILOT</h2>
                            <div className="space-y-2.5">
                              {ilotSection.design && renderSectionItem('Design', ilotSection.design)}
                              {ilotSection.color && renderSectionItem('Couleur', ilotSection.color)}
                              {ilotSection.handle && renderSectionItem('Poignées', ilotSection.handle)}
                              {ilotSection.worktop && renderSectionItem('Plan de travail', ilotSection.worktop)}
                            </div>
                          </div>
                        )}

                        {/* GLOBAL Section - Colonnes U à AF (20-31) */}
                        {(() => {
                          const globalValues: string[] = [];
                          for (let i = 20; i <= 31; i++) {
                            const extractedIndex = csvData.columnIndices?.indexOf(i);
                            if (extractedIndex >= 0 && extractedIndex < csvData.headers.length) {
                              const header = csvData.headers[extractedIndex];
                              const value = csvData.data[header]?.trim();
                              if (value) {
                                // Détecter si c'est un mitigeur et ajouter le préfixe
                                const lowerValue = value.toLowerCase();
                                if (lowerValue.includes('wave') || lowerValue.includes('mitigeur') || lowerValue.includes('laiton') || lowerValue.includes('brossé')) {
                                  globalValues.push(`Mitigeur: ${value}`);
                                } else {
                                  globalValues.push(value);
                                }
                              }
                            }
                          }
                          return globalValues.length > 0 ? (
                            <div className="mt-6">
                              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase">GLOBAL</h2>
                              <div className="space-y-2.5">
                                {globalValues.map((value, idx) => (
                                  <div key={idx} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                                    <span className="text-sm text-gray-900">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* DESCRIPTION Section - Colonne AG (32) */}
                        {(() => {
                          const extractedIndex = csvData.columnIndices?.indexOf(32);
                          if (extractedIndex >= 0 && extractedIndex < csvData.headers.length) {
                            const header = csvData.headers[extractedIndex];
                            const description = csvData.data[header]?.trim();
                            if (description) {
                              return (
                                <div className="mt-6">
                                  <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">DESCRIPTION</h2>
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{description}</p>
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}

                        {/* PIECES-JOINTES Section - Colonne AH (33) */}
                        {(() => {
                          const extractedIndex = csvData.columnIndices?.indexOf(33);
                          if (extractedIndex >= 0 && extractedIndex < csvData.headers.length) {
                            const header = csvData.headers[extractedIndex];
                            const piecesJointes = csvData.data[header]?.trim();
                            if (piecesJointes) {
                              return (
                                <div className="mt-6">
                                  <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">PIECES-JOINTES</h2>
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{piecesJointes}</p>
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                      </>
                    );
                  } else {
                    /* Monochrome: Afficher toutes les données sans sections TOP/BOTTOM/COLUMN */
                    const monoBottomSection = extractSectionFromCSV(csvData, 'bottom');
                    const monoTopSection = extractSectionFromCSV(csvData, 'top');
                    const monoColumnSection = extractSectionFromCSV(csvData, 'column');
                    
                    // Combiner toutes les données extraites
                    const allData = {
                      design: monoBottomSection.design || monoTopSection.design || monoColumnSection.design,
                      color: monoBottomSection.color || monoTopSection.color || monoColumnSection.color,
                      handle: monoBottomSection.handle || monoTopSection.handle || monoColumnSection.handle,
                      worktop: monoBottomSection.worktop,
                      backsplash: monoBottomSection.backsplash,
                      tap: monoBottomSection.tap,
                    };

                    // Afficher toutes les données disponibles depuis le CSV
                    const hasData = Object.values(allData).some(v => v);
                    
                    if (hasData) {
                      return (
                        <div className="space-y-2.5">
                          {allData.design && renderSectionItem('Design', allData.design)}
                          {allData.color && renderSectionItem('Couleur', allData.color)}
                          {allData.handle && renderSectionItem('Poignée', allData.handle)}
                          {allData.worktop && renderSectionItem('Plan de travail', allData.worktop)}
                          {allData.backsplash && renderSectionItem('Crédence', allData.backsplash)}
                          {allData.tap && renderSectionItem('Mitigeur', allData.tap)}
                        </div>
                      );
                    }

                    // Fallback: afficher toutes les données CSV disponibles
                    if (csvData.data && Object.keys(csvData.data).length > 0) {
                      return (
                        <div className="space-y-2.5">
                          {csvData.headers.map((header, idx) => {
                            const value = csvData.data[header];
                            if (!value || value.trim() === '') return null;
                            return (
                              <div key={idx} className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
                                <span className="text-sm text-gray-900">{value}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    return null;
                  }
                })()}

                {/* DESCRIPTION */}
                {(request.description || csvData.data['Description'] || csvData.data['DESCRIPTION']) && (
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
                {/* Client Name - affiché avant Metod */}
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">
                    {request.clientName || csvData?.data[csvData.headers?.[0]] || 'N/A'}
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
                  <span className="text-gray-400 font-semibold">Prix:</span>
                  <span className="text-gray-900 font-semibold">{formatPrice(request.price)}</span>
                </div>
                {csvData?.ikpLink && (
                  <div className="flex items-center gap-3 text-sm">
                    <Paperclip className="w-4 h-4 text-gray-400" />
                    <a
                      href={csvData.ikpLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Plan IKP
                    </a>
                  </div>
                )}
                {csvData?.thumbnail && (
                  <div className="flex items-center gap-3 text-sm">
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                    <div className="flex flex-col">
                      <span className="text-gray-600 text-xs">Thumbnail IKP</span>
                      <a
                        href={csvData.thumbnail}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline text-xs break-all"
                      >
                        Voir l'image
                      </a>
                    </div>
                  </div>
                )}
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
