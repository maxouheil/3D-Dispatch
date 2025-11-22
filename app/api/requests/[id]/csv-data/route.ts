import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request } from '@/lib/types';
import {
  parsePPCSVRequestData,
  parseClientCSVRequestData,
  findTypeformCSVs,
} from '@/lib/csv-request-parser';

const dataPath = path.join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Récupérer la request par ID
    const requests = getRequests();
    const req = requests.find((r) => r.id === params.id);

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Vérifier si la request a un projectCode
    if (!req.projectCode) {
      return NextResponse.json(
        {
          error: 'Request does not have a project code',
          message: 'Cannot find CSV data without project code',
        },
        { status: 400 }
      );
    }

    // Trouver les fichiers CSV dans Downloads
    const { ppCsv, clientCsv } = findTypeformCSVs();

    // Déterminer quel CSV utiliser selon le type de request
    let csvData = null;

    if (req.type === 'PP' && ppCsv) {
      try {
        csvData = parsePPCSVRequestData(ppCsv, req.projectCode);
      } catch (error: any) {
        console.error('Error parsing PP CSV:', error.message);
        return NextResponse.json(
          {
            error: 'Error parsing PP CSV',
            message: error.message,
          },
          { status: 500 }
        );
      }
    } else if (req.type === 'Client' && clientCsv) {
      try {
        csvData = parseClientCSVRequestData(clientCsv, req.projectCode);
      } catch (error: any) {
        console.error('Error parsing Client CSV:', error.message);
        return NextResponse.json(
          {
            error: 'Error parsing Client CSV',
            message: error.message,
          },
          { status: 500 }
        );
      }
    }

    if (!csvData) {
      // CSV non trouvé ou projectCode non trouvé dans le CSV
      const csvPath = req.type === 'PP' ? ppCsv : clientCsv;
      if (!csvPath) {
        return NextResponse.json(
          {
            error: 'CSV file not found',
            message: `No ${req.type} CSV file found in Downloads folder`,
          },
          { status: 404 }
        );
      } else {
        return NextResponse.json(
          {
            error: 'Project code not found in CSV',
            message: `Project code ${req.projectCode} not found in ${req.type} CSV`,
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(csvData);
  } catch (error: any) {
    console.error('Error fetching CSV data:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

