'use client';

import { Artist } from '@/lib/types';
import { getArtistFlag } from '@/lib/artist-flags';

interface ArtistBacklogSummaryProps {
  artists: Artist[];
}

export function ArtistBacklogSummary({ artists }: ArtistBacklogSummaryProps) {
  const calculateBacklogPercentage = (artist: Artist) => {
    const total = artist.backlogCount + artist.ongoingCount + artist.sentCount;
    if (total === 0) return 0;
    return Math.round((artist.backlogCount / total) * 100);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3 font-semibold text-gray-700">Name</th>
            <th className="text-center p-3 font-semibold text-gray-700">Backlog</th>
            <th className="text-center p-3 font-semibold text-gray-700">Ongoing</th>
            <th className="text-center p-3 font-semibold text-gray-700">Sent</th>
            <th className="text-center p-3 font-semibold text-gray-700">% Backlog</th>
            <th className="text-center p-3 font-semibold text-gray-700">Target/week</th>
          </tr>
        </thead>
        <tbody>
          {artists.map((artist) => {
            const backlogPercent = calculateBacklogPercentage(artist);
            return (
              <tr key={artist.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getArtistFlag(artist.name)}</span>
                    <span className="font-medium text-gray-900">{artist.name}</span>
                  </div>
                </td>
                <td className="p-3 text-center text-gray-700">{artist.backlogCount}</td>
                <td className="p-3 text-center text-gray-700">{artist.ongoingCount}</td>
                <td className="p-3 text-center text-gray-700">{artist.sentCount}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${backlogPercent}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-10 text-right">
                      {backlogPercent}%
                    </span>
                  </div>
                </td>
                <td className="p-3 text-center text-gray-700">{artist.targetPerWeek}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

