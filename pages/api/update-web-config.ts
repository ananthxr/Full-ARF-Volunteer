// API route for updating Web-config.JSON file with treasure data
// This endpoint manages the configuration file that Unity AR application reads

import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

interface TreasureData {
  imageName: string;
  fileName: string;
  physicalSizeInMeters: number;
  clueIndex: number;
  clueName: string;
  spawnOffset: { x: number; y: number; z: number };
  spawnRotation: { x: number; y: number; z: number };
  clueText: string;
  latitude: number;
  longitude: number;
  hasPhysicalGame: boolean;
  physicalGameInstruction: string;
  physicalGameSecretCode: string;
}

interface WebConfig {
  images: TreasureData[];
  lastUpdated: string;
  totalTreasures: number;
}

interface UpdateConfigRequest {
  treasures: TreasureData[];
}

interface UpdateConfigResponse {
  success: boolean;
  error?: string;
  configPath?: string;
  treasureCount?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateConfigResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { treasures }: UpdateConfigRequest = req.body;

    if (!Array.isArray(treasures)) {
      return res.status(400).json({ success: false, error: 'Invalid treasures data' });
    }

    // Create the web config object
    const webConfig: WebConfig = {
      images: treasures,
      lastUpdated: new Date().toISOString(),
      totalTreasures: treasures.length
    };

    console.log('Updating Web-config.JSON with treasures:', treasures.length);

    // Step 1: Save locally first
    const localConfigPath = path.join(process.cwd(), 'Web-config.JSON');
    try {
      await fs.writeFile(localConfigPath, JSON.stringify(webConfig, null, 2), 'utf8');
      console.log('Local Web-config.JSON updated successfully');
    } catch (localError) {
      console.error('Failed to save local config:', localError);
    }

    // Step 2: Upload to configured server
    let serverUpdateSuccess = false;
    try {
      console.log('Uploading Web-config.JSON to server...');
      
      const { getUploadWebConfigUrl, config } = await import('../../config');
      const serverResponse = await fetch(getUploadWebConfigUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.server.headers,
        },
        body: JSON.stringify(webConfig),
      });

      if (serverResponse.ok) {
        const serverResult = await serverResponse.json();
        serverUpdateSuccess = true;
        console.log('Server Web-config.JSON updated successfully:', serverResult);
      } else {
        console.error('Server config update failed:', serverResponse.status, serverResponse.statusText);
        const errorText = await serverResponse.text();
        console.error('Server error response:', errorText);
      }
    } catch (serverError) {
      console.error('Failed to upload config to server:', serverError);
    }

    // Step 3: Also try to save to public directory for local access
    try {
      const publicConfigPath = path.join(process.cwd(), 'public', 'Web-config.JSON');
      await fs.mkdir(path.dirname(publicConfigPath), { recursive: true });
      await fs.writeFile(publicConfigPath, JSON.stringify(webConfig, null, 2), 'utf8');
      console.log('Public Web-config.JSON updated successfully');
    } catch (publicError) {
      console.error('Failed to save public config:', publicError);
    }

    // Return success if at least local save worked
    return res.status(200).json({
      success: true,
      configPath: localConfigPath,
      treasureCount: treasures.length
    });

  } catch (error) {
    console.error('Web config update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update Web-config.JSON. Please try again.'
    });
  }
}