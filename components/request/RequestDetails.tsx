'use client';

import { Request } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { CSVRequestData } from '@/lib/csv-request-parser';

interface RequestDetailsProps {
  request: Request;
  csvData?: CSVRequestData | null;
  csvLoading?: boolean;
  csvError?: string | null;
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

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Design</h3>
            <p className="text-lg font-semibold">{request.design}</p>
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
            <p className="text-lg font-semibold">{request.price}€</p>
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



