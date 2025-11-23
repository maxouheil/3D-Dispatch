'use client';

import { Request } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { CSVRequestData } from '@/lib/csv-request-parser';
import { formatPrice } from '@/lib/format-utils';

interface RequestDetailsProps {
  request: Request;
  csvData?: CSVRequestData | null;
  csvLoading?: boolean;
  csvError?: string | null;
}

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
  const getValueByColumnIndex = (targetIndex: number): string | undefined => {
    const extractedIndex = columnIndices.indexOf(targetIndex);
    if (extractedIndex >= 0 && extractedIndex < headers.length) {
      const header = headers[extractedIndex];
      const value = data[header]?.trim();
      if (value && value !== '') return value;
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
      if (value && value !== '') return value;
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

// Helper to render a design/color/handle item with swatch
function renderSectionItem(label: string, value: string | undefined) {
  if (!value) return null;
  
  return (
    <div key={label} className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-200 rounded flex-shrink-0 border border-gray-300"></div>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export function RequestDetails({ request, csvData, csvLoading, csvError }: RequestDetailsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Extract sections from CSV data or use request.sections
  const topSection = csvData ? extractSectionFromCSV(csvData, 'top') : (request.sections?.top || {});
  const colonneSection = csvData ? extractSectionFromCSV(csvData, 'column') : (request.sections?.column || {});
  const bottomSection = csvData ? extractSectionFromCSV(csvData, 'bottom') : (request.sections?.bottom || {});
  const ilotSection = csvData ? extractIlotFromCSV(csvData) : {};

  // Fallback: if no sections extracted and we have old-style data, try to map it
  if (!bottomSection?.design && !topSection?.design && !colonneSection?.design && !ilotSection?.design) {
    if (request.design) {
      bottomSection.design = request.design;
      topSection.design = request.design;
      colonneSection.design = request.design;
    }
    if (request.colors?.bas) bottomSection.color = request.colors.bas;
    if (request.colors?.haut) topSection.color = request.colors.haut;
    if (request.colors?.colonne) colonneSection.color = request.colors.colonne;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Requête #{request.number}</CardTitle>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                request.type === 'PP'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {request.type}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
            <p className="text-lg">{request.clientName}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
            <p>{formatDate(request.date)}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              Lien IKP
            </h3>
            <a
              href={request.ikpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              {request.ikpLink}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Afficher les sections seulement si bicolor */}
          {csvData?.isBicolor ? (
            <>
              {/* HAUT Section - Caissons haut */}
              {(topSection?.design || topSection?.color || topSection?.handle) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">HAUT</h3>
                  <div className="space-y-2">
                    {topSection.design && renderSectionItem('Design', topSection.design)}
                    {topSection.color && renderSectionItem('Couleur', topSection.color)}
                    {topSection.handle && renderSectionItem('Poignées', topSection.handle)}
                  </div>
                </div>
              )}

              {/* BAS Section - Caissons bas */}
              {(bottomSection?.design || bottomSection?.color || bottomSection?.handle || bottomSection?.worktop || bottomSection?.backsplash || bottomSection?.tap) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">BAS</h3>
                  <div className="space-y-2">
                    {bottomSection.design && renderSectionItem('Design', bottomSection.design)}
                    {bottomSection.color && renderSectionItem('Couleur', bottomSection.color)}
                    {bottomSection.handle && renderSectionItem('Poignée', bottomSection.handle)}
                    {bottomSection.worktop && renderSectionItem('Plan de travail', bottomSection.worktop)}
                    {bottomSection.backsplash && renderSectionItem('Crédence', bottomSection.backsplash)}
                    {bottomSection.tap && renderSectionItem('Mitigeur', bottomSection.tap)}
                  </div>
                </div>
              )}

              {/* COLONNE Section - Colonnes */}
              {(colonneSection?.design || colonneSection?.color || colonneSection?.handle) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">COLONNE</h3>
                  <div className="space-y-2">
                    {colonneSection.design && renderSectionItem('Design', colonneSection.design)}
                    {colonneSection.color && renderSectionItem('Couleur', colonneSection.color)}
                    {colonneSection.handle && renderSectionItem('Poignée', colonneSection.handle)}
                  </div>
                </div>
              )}

              {/* ILOT Section - Ilot */}
              {(ilotSection?.design || ilotSection?.color || ilotSection?.handle || ilotSection?.worktop) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">ILOT</h3>
                  <div className="space-y-2">
                    {ilotSection.design && renderSectionItem('Design', ilotSection.design)}
                    {ilotSection.color && renderSectionItem('Couleur', ilotSection.color)}
                    {ilotSection.handle && renderSectionItem('Poignée', ilotSection.handle)}
                    {ilotSection.worktop && renderSectionItem('Plan de travail', ilotSection.worktop)}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Monochrome: Afficher toutes les données extraites sans sections */
            (() => {
              // Combiner toutes les données extraites
              const allData = {
                design: bottomSection?.design || topSection?.design || colonneSection?.design || ilotSection?.design,
                color: bottomSection?.color || topSection?.color || colonneSection?.color || ilotSection?.color,
                handle: bottomSection?.handle || topSection?.handle || colonneSection?.handle || ilotSection?.handle,
                worktop: bottomSection?.worktop,
                backsplash: bottomSection?.backsplash,
                tap: bottomSection?.tap,
              };

              const hasExtractedData = Object.values(allData).some(v => v);

              if (hasExtractedData) {
                return (
                  <div className="space-y-2">
                    {allData.design && renderSectionItem('Design', allData.design)}
                    {allData.color && renderSectionItem('Color', allData.color)}
                    {allData.handle && renderSectionItem('Handle', allData.handle)}
                    {allData.worktop && renderSectionItem('Worktop', allData.worktop)}
                    {allData.backsplash && renderSectionItem('Backsplash', allData.backsplash)}
                    {allData.tap && renderSectionItem('Tap', allData.tap)}
                  </div>
                );
              }

              // Fallback: Legacy display
              return (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Design</h3>
                    <p className="text-lg font-semibold">{request.design || 'N/A'}</p>
                  </div>

                  {Object.keys(request.colors).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        Couleurs
                      </h3>
                      <div className="space-y-1">
                        {request.colors.haut && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-20">Haut:</span>
                            <span className="font-medium">{request.colors.haut}</span>
                          </div>
                        )}
                        {request.colors.bas && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-20">Bas:</span>
                            <span className="font-medium">{request.colors.bas}</span>
                          </div>
                        )}
                        {request.colors.colonne && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-20">
                              Colonne:
                            </span>
                            <span className="font-medium">
                              {request.colors.colonne}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              Description
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {request.description}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Prix</h3>
            <p className="text-lg font-semibold text-gray-900">{formatPrice(request.price)}</p>
          </div>
        </CardContent>
      </Card>

      {/* CSV Data Section */}
      {csvData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Données CSV</CardTitle>
              <span className="text-xs text-gray-500">
                {csvData.type} {csvData.isBicolor ? '(Bicolore)' : '(Monochrome)'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {csvData.headers.map((header, index) => {
                const value = csvData.data[header];
                if (!value || value.trim() === '') return null;

                return (
                  <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">{header}</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{value}</p>
                  </div>
                );
              })}
              {csvData.isBicolor && csvData.type === 'Client' && csvData.data['_specialColumnG'] && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    Colonne G (Bicolore)
                  </h4>
                  <p className="text-sm text-blue-800">{csvData.data['_specialColumnG']}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {csvLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              Chargement des données CSV...
            </div>
          </CardContent>
        </Card>
      )}

      {csvError && !csvLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-red-600">
              <p className="font-medium mb-1">Erreur lors du chargement des données CSV</p>
              <p className="text-sm text-gray-600">{csvError}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



