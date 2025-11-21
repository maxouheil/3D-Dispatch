import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';
import { Request, Render } from '@/lib/types';

const requestsPath = join(process.cwd(), 'data', 'requests.json');
const rendersDir = join(process.cwd(), 'public', 'renders');

// Ensure renders directory exists
if (!fs.existsSync(rendersDir)) {
  fs.mkdirSync(rendersDir, { recursive: true });
}

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving requests:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const requestId = formData.get('requestId') as string;

    if (!file || !requestId) {
      return NextResponse.json(
        { error: 'Missing file or requestId' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${requestId}-${timestamp}.${extension}`;
    const filepath = join(rendersDir, filename);

    await writeFile(filepath, buffer);

    // Update request with new render
    const requests = getRequests();
    const reqIndex = requests.findIndex(r => r.id === requestId);

    if (reqIndex === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const newRender: Render = {
      id: `render-${timestamp}`,
      filename,
      url: `/renders/${filename}`,
      uploadedAt: new Date().toISOString(),
    };

    requests[reqIndex].renders.push(newRender);
    saveRequests(requests);

    return NextResponse.json(newRender);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

