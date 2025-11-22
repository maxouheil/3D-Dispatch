'use client';

import { Artist } from '@/lib/types';
import { getArtistFlag } from '@/lib/artist-flags';

interface ArtistBacklogSummaryProps {
  artists: Artist[];
}

export function ArtistBacklogSummary({ artists }: ArtistBacklogSummaryProps) {
  const calculateProgress = (artist: Artist) => {
    // Progress = (ongoing + sent this week) / target per week
    if (artist.targetPerWeek === 0) return 0;
    const total = artist.ongoingCount + artist.sentCount;
    const percentage = (total / artist.targetPerWeek) * 100;
    return Math.round(percentage);
  };

  const calculateOngoingPercentage = (artist: Artist) => {
    // Percentage of ongoing in the total progress
    if (artist.targetPerWeek === 0) return 0;
    const total = artist.ongoingCount + artist.sentCount;
    if (total === 0) return 0;
    return (artist.ongoingCount / total) * 100;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3 font-semibold text-gray-700">Name</th>
            <th className="text-center p-3 font-semibold text-gray-700">Sent this week</th>
            <th className="text-center p-3 font-semibold text-gray-700">Ongoing</th>
            <th className="text-center p-3 font-semibold text-gray-700">Progress</th>
            <th className="text-center p-3 font-semibold text-gray-700">Target/week</th>
          </tr>
        </thead>
        <tbody>
          {[...artists].sort((a, b) => b.targetPerWeek - a.targetPerWeek).map((artist) => {
            const progressPercent = calculateProgress(artist);
            const ongoingPercent = calculateOngoingPercentage(artist);
            const sentPercent = 100 - ongoingPercent;
            const total = artist.ongoingCount + artist.sentCount;
            
            return (
              <tr key={artist.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getArtistFlag(artist.name)}</span>
                    <span className="font-medium text-gray-900">{artist.name}</span>
                  </div>
                </td>
                <td className="p-3 text-center text-gray-700">{artist.sentCount}</td>
                <td className="p-3 text-center text-gray-700">{artist.ongoingCount}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 relative overflow-hidden">
                      {/* Progress bar with two segments: Green (Sent this week) + Orange (Ongoing) */}
                      <div
                        className="h-2 rounded-full transition-all absolute left-0 top-0 flex"
                        style={{ 
                          width: `${Math.min(progressPercent, 100)}%`
                        }}
                      >
                        {/* Green segment for Sent this week (first) */}
                        {artist.sentCount > 0 && total > 0 && (
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${(artist.sentCount / total) * 100}%` }}
                          />
                        )}
                        {/* Orange segment for Ongoing (second) */}
                        {artist.ongoingCount > 0 && total > 0 && (
                          <div
                            className="h-full bg-orange-300"
                            style={{ width: `${(artist.ongoingCount / total) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-20 text-right">
                      {Math.min(progressPercent, 100)}%
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

