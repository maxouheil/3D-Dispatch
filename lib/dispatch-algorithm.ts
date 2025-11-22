import { Request, Artist } from './types';

export interface DispatchConfig {
  backlogWeight: number; // Weight for backlog count (lower is better)
  performanceWeight: number; // Weight for performance score (higher is better)
  targetWeight: number; // Weight for target/week completion
}

export const defaultDispatchConfig: DispatchConfig = {
  backlogWeight: 0.4,
  performanceWeight: 0.4,
  targetWeight: 0.2,
};

/**
 * Calculate dispatch score for an artist
 * Lower score = better candidate (less backlog, higher performance)
 */
export function calculateDispatchScore(
  artist: Artist,
  config: DispatchConfig = defaultDispatchConfig
): number {
  // Normalize backlog (lower is better, so we invert it)
  const backlogScore = 1 / (1 + artist.backlogCount);
  
  // Normalize performance (higher is better)
  const performanceScore = artist.performanceScore / 100;
  
  // Calculate target completion rate
  const targetCompletionRate = artist.targetPerWeek > 0
    ? artist.currentWeekCompleted / artist.targetPerWeek
    : 1;
  // Lower completion rate = more capacity = better candidate
  const targetScore = 1 - Math.min(targetCompletionRate, 1);

  // Weighted combination (lower is better)
  const score =
    config.backlogWeight * (1 - backlogScore) +
    config.performanceWeight * (1 - performanceScore) +
    config.targetWeight * (1 - targetScore);

  return score;
}

/**
 * Find the best artist for a request based on dispatch algorithm
 */
export function findBestArtist(
  artists: Artist[],
  config: DispatchConfig = defaultDispatchConfig
): Artist | null {
  if (artists.length === 0) return null;

  let bestArtist = artists[0];
  let bestScore = calculateDispatchScore(artists[0], config);

  for (let i = 1; i < artists.length; i++) {
    const score = calculateDispatchScore(artists[i], config);
    if (score < bestScore) {
      bestScore = score;
      bestArtist = artists[i];
    }
  }

  return bestArtist;
}

/**
 * Auto-assign unassigned requests based on dispatch algorithm
 */
export function autoDispatchRequests(
  requests: Request[],
  artists: Artist[],
  config: DispatchConfig = defaultDispatchConfig
): Request[] {
  const unassignedRequests = requests.filter(req => 
    req.status === 'new' && !req.assignedTo
  );

  const updatedRequests = [...requests];

  for (const request of unassignedRequests) {
    const bestArtist = findBestArtist(artists, config);
    if (bestArtist) {
      const index = updatedRequests.findIndex(r => r.id === request.id);
      if (index !== -1) {
        updatedRequests[index].assignedTo = bestArtist.id;
      }
    }
  }

  return updatedRequests;
}



