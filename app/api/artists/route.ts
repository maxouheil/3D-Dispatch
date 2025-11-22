import { NextResponse } from 'next/server';
import { dummyArtists } from '@/lib/dummy-data';
import fs from 'fs';
import path from 'path';
import { Artist, Request } from '@/lib/types';
import { isBacklogStatus, isOngoingStatus, isSentStatus, isWithinCurrentWeek } from '@/lib/utils';

const dataPath = path.join(process.cwd(), 'data', 'artists.json');
const requestsPath = path.join(process.cwd(), 'data', 'requests.json');

function getArtists(): Artist[] {
  try {
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return dummyArtists;
  }
}

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

export async function GET() {
  const artists = getArtists();
  const requests = getRequests();

  // Calculate counts for each artist with new rules:
  // - Backlog = new + pending (no date filter)
  // - Ongoing = transmitted to 3D artist (no date filter)
  // - Sent = sent to client (current week only)
  const artistsWithCounts = artists.map((artist) => {
    // All artist requests (no date filter for backlog and ongoing)
    const artistRequests = requests.filter(
      (req) => req.assignedTo === artist.id
    );

    // Backlog: all "new" + "pending" (no date filter)
    const backlogCount = artistRequests.filter((r) => isBacklogStatus(r.status)).length;

    // Ongoing: transmitted to 3D artist (no date filter)
    const ongoingCount = artistRequests.filter(
      (r) => isOngoingStatus(r.status)
    ).length;

    // Sent: sent to client (current week only)
    const sentCount = artistRequests.filter(
      (r) => r.date && isSentStatus(r.status) && isWithinCurrentWeek(r.date)
    ).length;

    return {
      ...artist,
      backlogCount,
      ongoingCount,
      sentCount,
    };
  });

  return NextResponse.json(artistsWithCounts);
}

