// API route for deleting treasures (both config entry and image file)
// This endpoint removes treasures from the configuration and deletes the associated image

import { NextApiRequest, NextApiResponse } from 'next';

interface DeleteTreasureRequest {
  imageName: string;
  fileName: string;
}

interface DeleteTreasureResponse {
  success: boolean;
  error?: string;
  message?: string;
  imageDeleted?: boolean;
  configUpdated?: boolean;
  treasureRemoved?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteTreasureResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { imageName, fileName }: DeleteTreasureRequest = req.body;

    if (!imageName || !fileName) {
      return res.status(400).json({ success: false, error: 'Missing imageName or fileName' });
    }

    console.log('🗑️ Deleting treasure:', { imageName, fileName });

    // First, get current config from server to update it
    const { config } = await import('../../config');
    let currentTreasures: any[] = [];
    
    if (config.server.baseUrl) {
      try {
        console.log('📖 Getting current config from server...');
        const configResponse = await fetch(`${config.server.baseUrl}/config`, {
          headers: config.server.headers,
        });
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          currentTreasures = configData.images || [];
          console.log('📦 Current treasures on server:', currentTreasures.length);
        }
      } catch (error) {
        console.error('Failed to get current config:', error);
      }
    }
    let imageDeleteSuccess = false;
    
    if (config.server.baseUrl) {
      try {
        console.log('🗑️ Sending delete request to server:', `${config.server.baseUrl}/delete-image`);
        const deleteResponse = await fetch(`${config.server.baseUrl}/delete-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.server.headers,
          },
          body: JSON.stringify({ fileName }),
        });

        if (deleteResponse.ok) {
          const result = await deleteResponse.json();
          console.log('✅ Image deleted from server successfully:', result);
          imageDeleteSuccess = true;
        } else {
          const errorText = await deleteResponse.text();
          console.error('❌ Failed to delete image from server:', deleteResponse.status, errorText);
        }
      } catch (serverError) {
        console.error('❌ Failed to connect to server for image deletion:', serverError);
      }
    } else {
      console.warn('⚠️ No server configured, cannot delete image file');
    }

    // Update server config by removing the deleted treasure
    let configUpdateSuccess = false;
    if (config.server.baseUrl && currentTreasures.length > 0) {
      try {
        // Remove the treasure from the config
        const updatedTreasures = currentTreasures.filter(t => t.imageName !== imageName);
        console.log('📝 Updating server config, removing treasure:', imageName);
        console.log('📊 Treasures before:', currentTreasures.length, '→ after:', updatedTreasures.length);
        
        const updatedConfig = {
          images: updatedTreasures,
          lastUpdated: new Date().toISOString(),
          totalTreasures: updatedTreasures.length
        };
        
        const configUpdateResponse = await fetch(`${config.server.baseUrl}/upload-web-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.server.headers,
          },
          body: JSON.stringify(updatedConfig),
        });
        
        if (configUpdateResponse.ok) {
          console.log('✅ Server config updated successfully');
          configUpdateSuccess = true;
        } else {
          console.error('❌ Failed to update server config:', configUpdateResponse.status);
        }
      } catch (configError) {
        console.error('❌ Failed to update server config:', configError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Treasure deletion: Image ${imageDeleteSuccess ? 'deleted' : 'failed'}, Config ${configUpdateSuccess ? 'updated' : 'failed'}`,
      imageDeleted: imageDeleteSuccess,
      configUpdated: configUpdateSuccess,
      treasureRemoved: imageName
    });

  } catch (error) {
    console.error('Delete treasure error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete treasure: ' + errorMessage
    });
  }
}