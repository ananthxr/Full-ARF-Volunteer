// Configuration file for AR Treasure Hunt application
// Update these values for your development/production environment

export const config = {
  // Server Configuration
  server: {
    // Change this URL to your ngrok or development server
    baseUrl: 'https://13d6f2ae3427.ngrok-free.app',
    
    // API Endpoints (relative to baseUrl)
    endpoints: {
      uploadImage: '/upload-treasure-image',
      uploadWebConfig: '/upload-web-config'
    },
    
    // Request headers
    headers: {
      'ngrok-skip-browser-warning': 'true',
    }
  },

  // ARCore Configuration
  arcore: {
    // Minimum score required for image validation
    minValidationScore: 75,
    
    // ARCore executable command
    command: 'arcoreimg.exe'
  },

  // Application Settings
  app: {
    // Default maximum treasures per session
    defaultMaxTreasures: 5,
    
    // Development mode settings
    isDevelopment: process.env.NODE_ENV === 'development',
    
    // Enable debug logging
    debugMode: true
  }
};

// Helper functions for easy URL construction
export const getServerUrl = (endpoint?: string) => {
  const baseUrl = config.server.baseUrl;
  return endpoint ? `${baseUrl}${endpoint}` : baseUrl;
};

export const getUploadImageUrl = () => {
  return getServerUrl(config.server.endpoints.uploadImage);
};

export const getUploadWebConfigUrl = () => {
  return getServerUrl(config.server.endpoints.uploadWebConfig);
};