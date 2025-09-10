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
  storyAssetIndex: number;
  spawnOffset: { x: number; y: number; z: number };
  spawnRotation: { x: number; y: number; z: number };
  clueText: string;
  latitude: number;
  longitude: number;
  hasPhysicalGame: boolean;
  physicalGameInstruction: string;
  physicalGameSecretCode: string;
}

interface Storyline {
  selectedStory: string;
  storyTitle: string;
  storyDescription: string;
}

interface UnityStoryline {
  selectedStory: string; // Unity format: Story1_PirateAdventure_Assets, Story2_AncientEgypt_Assets, etc.
  storyTitle: string;
  storyDescription: string;
}

interface WebConfig {
  storyline: UnityStoryline;
  images: TreasureData[];
  lastUpdated: string;
  totalTreasures: number;
}

interface UpdateConfigRequest {
  treasures: TreasureData[];
  storyline?: Storyline;
}

interface UpdateConfigResponse {
  success: boolean;
  error?: string;
  configPath?: string;
  treasureCount?: number;
  message?: string;
  storylineUpdated?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateConfigResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { treasures, storyline }: UpdateConfigRequest = req.body;

    if (!Array.isArray(treasures)) {
      return res.status(400).json({ success: false, error: 'Invalid treasures data' });
    }

    // Helper function to get storyline title and description
    const getStorylineInfo = (selectedStory: string) => {
      const storylines = {
        'Story1_PirateAdventure_Assets': {
          title: 'Pirate Adventure',
          description: 'Embark on a swashbuckling treasure hunt across the seven seas!'
        },
        'Story2_AncientEgypt_Assets': {
          title: 'Ancient Egypt Explorer',
          description: 'Uncover the mysteries of the pharaohs and ancient pyramids!'
        },
        'Story3_SpaceExplorer_Assets': {
          title: 'Space Explorer',
          description: 'Journey through the cosmos and discover alien civilizations!'
        }
      };
      return storylines[selectedStory as keyof typeof storylines] || storylines['Story1_PirateAdventure_Assets'];
    };

    // Convert storyline to Unity format
    const convertToUnityFormat = (storyline: Storyline) => {
      const unityMapping: { [key: string]: string } = {
        'Story1_PirateAdventure_Assets': 'Story1_PirateAdventure_Assets',
        'Story2_AncientEgypt_Assets': 'Story2_AncientEgypt_Assets', 
        'Story3_SpaceExplorer_Assets': 'Story3_SpaceExplorer_Assets'
      };

      return {
        selectedStory: unityMapping[storyline.selectedStory] || 'Story1_PirateAdventure_Assets',
        storyTitle: storyline.storyTitle,
        storyDescription: storyline.storyDescription
      };
    };

    // Default storyline if not provided
    const defaultStoryline = storyline || {
      selectedStory: 'Story1_PirateAdventure_Assets',
      storyTitle: 'Pirate Adventure',
      storyDescription: 'Embark on a swashbuckling treasure hunt across the seven seas!'
    };

    // Ensure storyline has proper title and description
    if (!defaultStoryline.storyTitle || !defaultStoryline.storyDescription) {
      const info = getStorylineInfo(defaultStoryline.selectedStory);
      defaultStoryline.storyTitle = info.title;
      defaultStoryline.storyDescription = info.description;
    }

    // Convert to Unity format
    const unityStoryline = convertToUnityFormat(defaultStoryline);
    console.log('🎭 Converted storyline to Unity format:', unityStoryline);

    // Auto-generate storyAssetIndex for each treasure (sequential: 0, 1, 2, ...)
    const treasuresWithStoryIndex = treasures.map((treasure, index) => ({
      ...treasure,
      storyAssetIndex: index
    }));

    // Create the web config object with Unity format
    const webConfig: WebConfig = {
      storyline: unityStoryline,
      images: treasuresWithStoryIndex,
      lastUpdated: new Date().toISOString(),
      totalTreasures: treasures.length
    };

    console.log('Updating Web-config.JSON with treasures:', treasures.length);
    console.log('Final config object:', JSON.stringify(webConfig, null, 2));

    // Step 1: Upload to treasure server via ngrok (PRIMARY METHOD)
    // This is the correct way - server manages its own config.json
    let serverUpdateSuccess = false;
    try {
      console.log('🚀 Uploading config with storyline to treasure server...');
      console.log('📤 Storyline being sent:', JSON.stringify(unityStoryline, null, 2));
      
      const { getUploadWebConfigUrl, config } = await import('../../config');
      const uploadUrl = getUploadWebConfigUrl();
      console.log('🌐 Upload URL:', uploadUrl);
      
      const serverResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.server.headers,
        },
        body: JSON.stringify(webConfig),
      });

      console.log('📥 Server response status:', serverResponse.status);

      if (serverResponse.ok) {
        const serverResult = await serverResponse.json();
        serverUpdateSuccess = true;
        console.log('✅ Server config.json updated successfully:', serverResult);
        console.log('✅ Storyline saved to server successfully');
      } else {
        console.error('❌ Server config update failed:', serverResponse.status, serverResponse.statusText);
        const errorText = await serverResponse.text();
        console.error('❌ Server error response:', errorText);
        
        // Return error if server update fails - this is critical
        return res.status(500).json({
          success: false,
          error: `Server update failed: ${serverResponse.status} ${serverResponse.statusText}`
        });
      }
    } catch (serverError) {
      console.error('❌ Failed to upload config to server:', serverError);
      return res.status(500).json({
        success: false,
        error: `Failed to connect to treasure server: ${serverError instanceof Error ? serverError.message : 'Unknown error'}`
      });
    }

    // Step 2: Save local backup only if server update succeeded
    if (serverUpdateSuccess) {
      const localConfigPath = path.join(process.cwd(), 'Web-config.JSON');
      try {
        await fs.writeFile(localConfigPath, JSON.stringify(webConfig, null, 2), 'utf8');
        console.log('✅ Local backup saved successfully');
      } catch (localError) {
        console.error('⚠️ Local backup failed (not critical):', localError);
      }
    }

    // Step 3: Also save to public directory for local access (optional)
    try {
      const publicConfigPath = path.join(process.cwd(), 'public', 'Web-config.JSON');
      await fs.mkdir(path.dirname(publicConfigPath), { recursive: true });
      await fs.writeFile(publicConfigPath, JSON.stringify(webConfig, null, 2), 'utf8');
      console.log('✅ Public directory backup updated successfully');
    } catch (publicError) {
      console.error('⚠️ Public directory backup failed (not critical):', publicError);
    }

    // Return success - server update is the primary requirement
    return res.status(200).json({
      success: true,
      message: 'Config successfully uploaded to treasure server',
      treasureCount: treasures.length,
      storylineUpdated: true
    });

  } catch (error) {
    console.error('Web config update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update Web-config.JSON. Please try again.'
    });
  }
}