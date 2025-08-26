# AR Treasure Hunt - Volunteer Dashboard

A comprehensive Next.js web application for managing AR treasure hunt events, featuring volunteer dashboards and treasure setup interfaces.

## Features

### 🎯 Volunteer Dashboard (`/`)
- **Real-time Team Management**: View and manage registered teams with live database sync
- **Score Tracking**: Monitor AR game scores and physical challenge scores
- **Tabular Physical Scoring**: Detailed scoring system with volunteer attribution and benchmarks
- **Hunt Control**: Password-protected start/end hunt functionality
- **Team Progress**: Track clue completion and session status
- **Admin Controls**: Reset all teams and manage hunt state

### 🗺️ Hide Treasures Interface (`/hide-treasures`)
**New Feature for Frontman Setup**

- **Image Capture**: WebRTC camera integration for capturing treasure marker images
- **ARCore Validation**: Automatic image quality validation using `arcoreimg`
- **GPS Integration**: Capture precise coordinates for each treasure location  
- **Server Upload**: Automatic upload to configured server endpoint
- **Interactive Clue Builder**: Rich interface for creating treasure hunt clues
- **Physical Challenge Setup**: Optional physical game configuration with secret codes
- **Progress Tracking**: Monitor treasure hiding progress with counter
- **Web-config.JSON Generation**: Automatic configuration file creation for Unity AR app

## 🔧 Configuration

### 📍 Server URL Configuration (IMPORTANT!)

**Edit `config.ts` to change your development server:**

```typescript
export const config = {
  server: {
    // 🚀 CHANGE THIS to your ngrok or development server URL
    baseUrl: 'https://your-new-url.ngrok-free.app',
    
    endpoints: {
      uploadImage: '/upload-treasure-image',
      uploadWebConfig: '/upload-web-config'
    },
    
    headers: {
      'ngrok-skip-browser-warning': 'true',
    }
  },
  
  arcore: {
    // Minimum score required for image validation (0-100)
    minValidationScore: 75,
    command: 'arcoreimg'
  },
  
  app: {
    // Default maximum treasures per session
    defaultMaxTreasures: 5,
    debugMode: true
  }
};
```

### Quick Setup for Development:

1. **📝 Update Server URL**: Change `baseUrl` in `config.ts` to your server
2. **🚀 Run Dev Server**: `npm run dev`
3. **📸 Test Camera**: Navigate to "Hide Treasures" and test functionality
4. **🏗️ Deploy**: `npm run build && npm start` for production

## Technical Stack

- **Framework**: Next.js 13 with TypeScript
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Anonymous Auth
- **File Upload**: Formidable for multipart form handling
- **Image Processing**: ARCore Image Evaluation (`arcoreimg`)
- **Styling**: CSS-in-JS with styled-jsx
- **Configuration**: Centralized config system

## Setup Instructions

### Prerequisites
- Node.js 16+ 
- `arcoreimg` (Google ARCore Image Tool)
- Development server (ngrok, localhost, etc.)

### Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Server URL**:
   - Open `config.ts` in root directory
   - Update `server.baseUrl` with your server URL
   ```typescript
   baseUrl: 'https://your-server.ngrok-free.app'
   ```

3. **Configure Firebase**:
   - Update Firebase config in `lib/firebase.ts`
   - Ensure Realtime Database rules allow read/write access

4. **ARCore Setup**:
   - Install Google ARCore SDK Tools
   - Ensure `arcoreimg` is in system PATH
   - Adjust validation threshold in `config.ts` if needed

5. **Server Setup**:
   - Configure your server to accept:
     - `POST /upload-treasure-image` (multipart image upload)
     - `POST /upload-web-config` (JSON configuration)

### Development

```bash
# Start development server
npm run dev

# Build for production  
npm run build
npm start

# Lint code
npm run lint
```

## Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `server.baseUrl` | Main server URL | ngrok URL |
| `arcore.minValidationScore` | Image quality threshold (1-100) | 75 |
| `app.defaultMaxTreasures` | Max treasures per session | 5 |
| `app.debugMode` | Enable console logging | true |

## API Endpoints

### `/api/validate-and-upload-image`
- **Method**: POST (multipart/form-data)
- **Purpose**: Validates images with ARCore and uploads to server
- **Fields**: `image`, `imageName`, `latitude`, `longitude`
- **Returns**: `{ success, score, uploadUrl }`

### `/api/update-web-config`  
- **Method**: POST (JSON)
- **Purpose**: Updates Web-config.JSON with treasure data
- **Body**: `{ treasures: TreasureData[] }`
- **Returns**: `{ success, configPath, treasureCount }`

## Treasure Data Structure

```typescript
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
```

## Usage Workflow

### For Volunteers:
1. Access main dashboard (`/`)
2. Monitor team progress and scores
3. Use tabular scoring for physical challenges
4. Control hunt start/end with password protection

### For Frontman (Treasure Setup):
1. **Configure**: Update server URL in `config.ts`
2. Navigate to "Hide Treasures" from admin controls
3. Grant GPS and camera permissions
4. Capture high-quality images of treasure locations
5. System validates images with ARCore (>75 score required)
6. Create engaging clues for each treasure
7. Configure optional physical challenges
8. System generates `Web-config.JSON` for Unity AR app

## Image Quality Guidelines

**✅ Good Images:**
- Rich visual features (signs, artwork, detailed textures)
- High contrast between light and dark areas
- Sharp focus with clear edges and corners
- Unique patterns and distinctive elements

**❌ Avoid:**
- Blank walls or featureless surfaces
- Repetitive patterns (brick, carpet)
- Reflective or shiny surfaces
- Blurry or low-contrast images

## File Structure

```
├── config.ts                         # 🆕 Configuration file
├── pages/
│   ├── index.tsx                     # Main volunteer dashboard
│   ├── hide-treasures.tsx            # Frontman treasure setup
│   └── api/
│       ├── validate-and-upload-image.ts
│       └── update-web-config.ts
├── components/
│   └── Layout.tsx                    # Shared layout component  
├── lib/
│   ├── firebase.ts                   # Firebase configuration
│   └── firestore.ts                  # Database operations
└── public/
    └── Web-config.JSON               # Generated treasure configuration
```

## Security Notes

- Admin actions require password authentication (`ananthJEE2@`)
- Firebase uses anonymous authentication for basic access
- ARCore validation prevents low-quality tracking images
- GPS permissions required for accurate treasure positioning
- Server URL configured in single location for security

## Troubleshooting

### Configuration Issues:
- **Wrong Server URL**: Update `config.ts` with correct server URL
- **API Endpoints**: Ensure server accepts the configured endpoints
- **Headers**: Modify `config.server.headers` for your server requirements

### ARCore Issues:
- Ensure `arcoreimg` is accessible in PATH
- Check image quality if validation fails
- Adjust `config.arcore.minValidationScore` if needed

### Server Upload Issues:
- Confirm server URL is correct in `config.ts`
- Check network connectivity
- Verify server accepts multipart uploads

### Camera Access:
- Grant browser camera permissions
- Use HTTPS for production deployment
- Test on modern browsers with WebRTC support

---

**Version**: 1.3 - Added Hide Treasures Interface + Configuration System  
**Last Updated**: 2025-01-25