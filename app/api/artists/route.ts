import { NextResponse } from 'next/server';
import { dummyArtists } from '@/lib/dummy-data';
import fs from 'fs';
import path from 'path';
import { Artist } from '@/lib/types';

const dataPath = path.join(process.cwd(), 'data', 'artists.json');

function getArtists(): Artist[] {
  try {
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return dummyArtists;
  }
}

export async function GET() {
  const artists = getArtists();
  return NextResponse.json(artists);
}

