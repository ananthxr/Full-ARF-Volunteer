// Hide the Treasures Page - Frontman interface for setting up AR treasure hunt markers
// This page allows the Frontman to capture images, validate them with ARCore, and create clues

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { config } from '@/config';

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

interface GPSCoordinates {
  latitude: number;
  longitude: number;
}

type PageStep = 'storyline-selection' | 'setup' | 'capture' | 'crop' | 'processing' | 'clue-builder' | 'complete';

export default function HideTreasures() {
  const [currentStep, setCurrentStep] = useState<PageStep>('storyline-selection');
  const [treasureCount, setTreasureCount] = useState(0);
  const [maxTreasures, setMaxTreasures] = useState(config.app.defaultMaxTreasures);
  const [availableAssets, setAvailableAssets] = useState(3); // Will be fetched from server config
  const [showInstructions, setShowInstructions] = useState(false);
  const [gpsPermission, setGpsPermission] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);
  const [treasures, setTreasures] = useState<TreasureData[]>([]);
  
  // Storyline state
  const [selectedStoryline, setSelectedStoryline] = useState<Storyline>({
    selectedStory: 'Story1_PirateAdventure_Assets',
    storyTitle: 'Pirate Adventure',
    storyDescription: 'Embark on a swashbuckling treasure hunt across the seven seas!'
  });
  
  // Camera related states
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 200 });
  const [imageName, setImageName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationScore, setValidationScore] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  // Backup ref to store image data in case state gets lost
  const capturedImageBackup = useRef<string | null>(null);
  
  // Additional state for image name input
  const [isNamingImage, setIsNamingImage] = useState(false);
  const [tempImageData, setTempImageData] = useState<string | null>(null);
  
  // Debug state to track what's happening
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]); // Keep last 10 entries
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      const { clientWidth, clientHeight } = imageRef.current;
      setImageDimensions({ width: clientWidth, height: clientHeight });
    }
  };
  
  // Clue builder states
  const [currentTreasure, setCurrentTreasure] = useState<Partial<TreasureData> | null>(null);
  const [clueText, setClueText] = useState('');
  const [hasPhysicalGame, setHasPhysicalGame] = useState(false);
  const [physicalInstruction, setPhysicalInstruction] = useState('');
  const [secretCode, setSecretCode] = useState('');

  // Available storylines
  const availableStorylines = [
    {
      selectedStory: 'Story1_PirateAdventure_Assets',
      storyTitle: 'Pirate Adventure',
      storyDescription: 'Embark on a swashbuckling treasure hunt across the seven seas!'
    },
    {
      selectedStory: 'Story2_AncientEgypt_Assets',
      storyTitle: 'Ancient Egypt Explorer',
      storyDescription: 'Uncover the mysteries of the pharaohs and ancient pyramids!'
    },
    {
      selectedStory: 'Story3_SpaceExplorer_Assets',
      storyTitle: 'Space Explorer',
      storyDescription: 'Journey through the cosmos and discover alien civilizations!'
    }
  ];

  // Helper function to update storyline when selection changes
  const updateStorylineSelection = (selectedStoryValue: string) => {
    const storyline = availableStorylines.find(s => s.selectedStory === selectedStoryValue);
    if (storyline) {
      setSelectedStoryline(storyline);
    }
  };

  // Save storyline selection and update config immediately
  const saveStorylineAndProceed = async () => {
    try {
      console.log('💾 Saving storyline selection:', selectedStoryline);
      console.log('📦 Current treasures being sent:', treasures);
      
      // Set asset count to 3 - each storyline has exactly 3 assets in the bundle
      console.log('🎯 Setting available assets to 3 (each storyline has 3 preset assets)');
      setAvailableAssets(3);
      setMaxTreasures(3);
      
      // Update web config with the selected storyline (and any existing treasures)
      const requestBody = { 
        images: treasures, // Use 'images' key as expected by server
        storyline: selectedStoryline,
        lastUpdated: new Date().toISOString(),
        totalTreasures: treasures.length
      };
      
      console.log('📤 Request body being sent:', JSON.stringify(requestBody, null, 2));
      
      // First, update local web config
      const localResponse = await fetch('/api/update-web-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treasures: treasures, storyline: selectedStoryline })
      });

      console.log('📥 Local config response status:', localResponse.status);
      
      // Then, update server config
      console.log('🔥 Firing server config update:', `${config.server.baseUrl}/upload-web-config`);
      const serverResponse = await fetch(`${config.server.baseUrl}/upload-web-config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...config.server.headers
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Server config response status:', serverResponse.status);
      console.log('📥 Server config response ok:', serverResponse.ok);

      if (localResponse.ok && serverResponse.ok) {
        const result = await serverResponse.json();
        console.log('✅ Server API response:', result);
        console.log('✅ Storyline saved successfully to both local and server config');
        console.log('📍 Now requesting GPS permission...');
        
        // Request GPS permission after storyline is saved
        await requestGPSPermission();
        
        console.log('🎯 Setting current step to setup...');
        setCurrentStep('setup'); // Proceed to setup step
        console.log('🎯 Current step should now be setup');
      } else {
        if (!localResponse.ok) {
          const errorText = await localResponse.text();
          console.error('❌ Failed to save local config:', localResponse.status, errorText);
        }
        if (!serverResponse.ok) {
          const errorText = await serverResponse.text();
          console.error('❌ Failed to save server config:', serverResponse.status, errorText);
        }
        // Show error in UI instead of alert - will handle this in UI
      }
    } catch (error) {
      console.error('❌ Error saving storyline:', error);
      // Show error in UI instead of alert - will handle this in UI
    }
  };

  // Debug effect to track capturedImage changes
  useEffect(() => {
    const exists = !!capturedImage;
    const length = capturedImage ? capturedImage.length : 0;
    addDebugLog(`🖼️ capturedImage changed: ${exists ? `YES (${length} chars)` : 'NULL'}`);
    console.log('🖼️ capturedImage state changed:', {
      exists,
      length,
      preview: capturedImage ? capturedImage.substring(0, 50) + '...' : 'null'
    });
  }, [capturedImage]);

  // Debug effect to track currentStep changes
  useEffect(() => {
    addDebugLog(`📍 Step changed to: ${currentStep}`);
    console.log('📍 currentStep changed to:', currentStep);
  }, [currentStep]);
  
  // Debug effect to track tempImageData changes
  useEffect(() => {
    const exists = !!tempImageData;
    const length = tempImageData ? tempImageData.length : 0;
    if (exists || debugLog.length > 0) { // Only log if we have data or if we're already logging
      addDebugLog(`🔄 tempImageData changed: ${exists ? `YES (${length} chars)` : 'NULL'}`);
    }
  }, [tempImageData]);
  
  // Debug effect to track imageName changes
  useEffect(() => {
    if (imageName || debugLog.length > 0) { // Only log if we have name or if we're already logging
      addDebugLog(`📝 imageName changed: '${imageName}'`);
    }
  }, [imageName]);

  // Load existing treasures and determine starting step
  const loadExistingTreasuresAndDetermineStep = async () => {
    try {
      // ONLY load from server - no local fallback
      if (config.server.baseUrl) {
        try {
          console.log('📡 Loading existing treasures from server:', `${config.server.baseUrl}/config`);
          const response = await fetch(`${config.server.baseUrl}/config`, {
            headers: config.server.headers,
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('📦 Loaded existing treasures from server:', data.images?.length);
            console.log('🏴‍☠️ Existing treasure names:', data.images?.map((t: TreasureData) => t.clueName));
            console.log('📖 Existing storyline data:', data.storyline);
            
            const existingTreasures = data.images || [];
            setTreasures(existingTreasures);
            setTreasureCount(existingTreasures.length);
            
            // Check if storyline exists and treasures exist
            if (data.storyline && data.storyline.selectedStory) {
              // Storyline already exists, load it
              setSelectedStoryline(data.storyline);
              console.log('✅ Existing storyline loaded:', data.storyline.storyTitle);
              
              // Only auto-redirect to setup if we have treasures (indicating established session)
              // If no treasures, keep on storyline selection to let user proceed manually
              if (existingTreasures.length > 0) {
                setCurrentStep('setup');
                console.log('🎯 Step: setup (storyline + treasures exist - auto-redirect)');
              } else {
                // Keep on storyline-selection step - let user click "Save & Continue"
                setCurrentStep('storyline-selection');
                console.log('🎯 Step: storyline-selection (storyline exists but no treasures - manual proceed)');
              }
            } else {
              // No storyline exists, force storyline selection first
              console.log('📖 No storyline found, requiring storyline selection');
              setCurrentStep('storyline-selection');
              console.log('🎯 Step: storyline-selection (no storyline found)');
            }
            return;
          } else {
            console.warn('Server returned error when loading treasures:', response.status);
          }
        } catch (serverError) {
          console.warn('Failed to load treasures from server:', serverError);
        }
      } else {
        console.warn('No server configured, starting with empty treasure list');
      }
      
      // If server fails, start fresh with storyline selection
      console.log('Starting with empty treasure list and storyline selection');
      setTreasures([]);
      setTreasureCount(0);
      setCurrentStep('storyline-selection');
      console.log('🎯 Step: storyline-selection (server unavailable)');
    } catch (error) {
      console.error('Error loading existing treasures:', error);
      setCurrentStep('storyline-selection');
    }
  };

  // Legacy function for backwards compatibility
  const loadExistingTreasures = async () => {
    await loadExistingTreasuresAndDetermineStep();
  };

  // Initialization effect - only runs once on component mount
  useEffect(() => {
    console.log('🚀 Component mounting - initializing...');
    // Don't request GPS permission immediately - wait until setup step
    loadExistingTreasuresAndDetermineStep();
  }, []); // Empty dependency array - runs only once

  // GPS permission will now be requested manually when user clicks "Save & Continue"
  // Removed automatic GPS request to give user more control

  // Event listeners effect - updates when dependencies change
  useEffect(() => {
    // Add mobile-specific event listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraStream && currentStep === 'capture') {
        console.log('Page became visible, refreshing camera...');
        // Auto-refresh camera when page becomes visible
        setTimeout(() => {
          refreshVideoFeed();
        }, 300);
      }
    };
    
    const handleFocus = () => {
      if (cameraStream && currentStep === 'capture') {
        console.log('Window focused, refreshing camera...');
        setTimeout(() => {
          refreshVideoFeed();
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [cameraStream, currentStep]);

  const requestGPSPermission = async () => {
    console.log('Requesting GPS permission...');
    try {
      if ('geolocation' in navigator) {
        console.log('Geolocation API available');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject,
            { 
              timeout: 10000,
              enableHighAccuracy: false,
              maximumAge: 300000 // 5 minutes
            }
          );
        });
        
        console.log('GPS position obtained:', position);
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsPermission(true);
        console.log('GPS permission granted');
      } else {
        console.log('Geolocation API not available');
        setGpsPermission(true); // Allow to proceed without GPS
      }
    } catch (error) {
      console.error('GPS permission denied or failed:', error);
      setGpsPermission(true); // Allow to proceed without GPS for testing
    }
  };

  const testCameraAccess = async () => {
    console.log('=== TESTING BASIC CAMERA ACCESS ===');
    
    try {
      console.log('Requesting basic video stream...');
      const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('✅ Basic camera access successful!', testStream);
      
      // Test video element
      if (videoRef.current) {
        videoRef.current.srcObject = testStream;
        await videoRef.current.play();
        console.log('✅ Video element working!');
      }
      
      alert('✅ Camera test successful! Check console for details.');
      
    } catch (error) {
      console.error('❌ Camera test failed:', error);
      alert(`❌ Camera test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const diagnoseCameraIssues = async () => {
    console.log('=== CAMERA DIAGNOSTICS ===');
    
    // Check browser support
    console.log('Browser support:', {
      getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      mediaDevices: !!navigator.mediaDevices,
      userAgent: navigator.userAgent,
      protocol: window.location.protocol,
      isSecure: window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    });

    // Check available devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('Available video devices:', videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label,
        kind: device.kind
      })));
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }

    // Check permissions
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      console.log('Camera permission status:', permissionStatus.state);
    } catch (error) {
      console.warn('Could not check camera permission:', error);
    }

    // Check current video element state
    if (videoRef.current) {
      console.log('Video element state:', {
        readyState: videoRef.current.readyState,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
        paused: videoRef.current.paused,
        ended: videoRef.current.ended,
        srcObject: !!videoRef.current.srcObject,
        src: videoRef.current.src
      });
    }

    alert('Camera diagnostics logged to console. Press F12 to view.');
  };

  const refreshVideoFeed = async () => {
    if (!cameraStream || !videoRef.current) return;
    
    console.log('Refreshing video feed...');
    
    try {
      const video = videoRef.current;
      
      // Reset the video element
      video.pause();
      video.srcObject = null;
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reassign stream
      video.srcObject = cameraStream;
      video.playsInline = true;
      video.muted = true;
      
      // Try to play
      video.play().catch(error => {
        console.warn('Auto-play failed after refresh, user interaction may be needed:', error);
      });
      
      console.log('Video feed refreshed successfully');
      
    } catch (error) {
      console.error('Failed to refresh video feed:', error);
      alert('Unable to refresh video feed. Please reload the page or restart the camera.');
    }
  };

  const startHidingTreasures = async () => {
    try {
      console.log('Starting camera initialization...');
      console.log('Config loaded:', config);
      console.log('GPS permission:', gpsPermission);
      console.log('Current location:', currentLocation);
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available');
        alert('Camera is not supported on this device/browser. Please use a modern browser.');
        return;
      }
      
      console.log('MediaDevices API available, requesting camera access...');

      // Simplified camera configuration - try basic approach first
      const cameraConfigs = [
        // Primary: Try environment camera for mobile
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        },
        // Fallback 1: Any camera with basic constraints
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        },
        // Last resort: Just request video
        {
          video: true,
          audio: false
        }
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (let i = 0; i < cameraConfigs.length; i++) {
        try {
          console.log(`Trying camera config ${i + 1}:`, cameraConfigs[i]);
          stream = await navigator.mediaDevices.getUserMedia(cameraConfigs[i]);
          console.log('Camera stream obtained successfully:', stream);
          break;
        } catch (error) {
          console.warn(`Camera config ${i + 1} failed:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      if (!stream) {
        throw lastError || new Error('No camera configuration worked');
      }

      // Verify stream has video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video track found in stream');
      }

      console.log('Video tracks:', videoTracks.length);

      setCameraStream(stream);
      setCameraPermission(true);
      
      if (videoRef.current) {
        console.log('Setting video source...');
        const video = videoRef.current;
        
        // Set essential video properties
        video.playsInline = true;
        video.muted = true;
        video.controls = false;
        
        // Assign stream directly
        video.srcObject = stream;
        
        console.log('Stream assigned to video element');
        
        // Wait for video to be ready
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          });
          
          // Try to play the video
          video.play().catch(error => {
            console.warn('Auto-play failed, user interaction required:', error);
            // This is expected on many browsers/devices
          });
        };
        
        video.onerror = (error) => {
          console.error('Video error:', error);
        };
      }
      
      setCurrentStep('capture');
      console.log('Camera initialization complete');
    } catch (error) {
      console.error('Camera initialization failed:', error);
      let errorMessage = 'Camera access failed. ';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Please allow camera access and refresh the page.';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage += 'Camera is being used by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage += 'Camera constraints not supported. Please try a different device.';
        } else {
          errorMessage += `${error.message || 'Unknown error occurred.'}`;
        }
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      alert(errorMessage);
    }
  };

  const captureImage = () => {
    console.log('=== CAPTURE IMAGE STARTED ===');
    
    if (!videoRef.current || !canvasRef.current) {
      console.error('Missing video or canvas reference');
      alert('Camera or canvas not ready. Please try again.');
      return;
    }
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Could not get canvas context');
      alert('Canvas error. Please refresh the page and try again.');
      return;
    }

    console.log('Video dimensions:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState
    });

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video has no dimensions - camera may not be ready');
      alert('Camera not ready. Please wait for the camera to load or try refreshing.');
      return;
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Convert to base64 image
    const imageData = canvas.toDataURL('image/png');
    console.log('Image captured, data length:', imageData.length);
    
    if (!imageData || imageData === 'data:,') {
      console.error('Failed to capture image data');
      alert('Failed to capture image. Please try again.');
      return;
    }

    // Store image data immediately and persistently
    console.log('🔒 Storing image data securely...');
    addDebugLog(`📸 Image captured: ${imageData.length} chars`);
    
    setCapturedImage(imageData);
    addDebugLog('✅ setCapturedImage called');
    
    capturedImageBackup.current = imageData; // Store backup
    addDebugLog('✅ capturedImageBackup.current set');
    
    setTempImageData(imageData); // Additional backup
    addDebugLog('✅ setTempImageData called');
    
    // Update current location at moment of capture
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      });
    }
    
    // Initialize crop area based on video dimensions
    const centerX = Math.max(0, (video.videoWidth - 200) / 2);
    const centerY = Math.max(0, (video.videoHeight - 200) / 2);
    const cropAreaData = {
      x: centerX,
      y: centerY,
      width: Math.min(200, video.videoWidth),
      height: Math.min(200, video.videoHeight)
    };
    
    console.log('Setting crop area:', cropAreaData);
    setCropArea(cropAreaData);
    
    // Move to naming step instead of using prompt
    console.log('Moving to naming step...');
    addDebugLog('📝 Moving to naming step');
    setIsNamingImage(true);
    setCurrentStep('crop');
    addDebugLog('📍 Current step set to crop');
  };

  const cropImage = () => {
    console.log('=== CROP IMAGE STARTED ===');
    addDebugLog('🚀 CROP IMAGE STARTED');
    
    console.log('Captured image exists:', !!capturedImage);
    addDebugLog(`📊 capturedImage: ${capturedImage ? 'EXISTS' : 'NULL'}`);
    
    console.log('Canvas ref exists:', !!canvasRef.current);
    addDebugLog(`🖼️ canvasRef: ${canvasRef.current ? 'EXISTS' : 'NULL'}`);
    
    console.log('Current step:', currentStep);
    addDebugLog(`📍 currentStep: ${currentStep}`);
    
    console.log('Image name:', imageName);
    addDebugLog(`📝 imageName: '${imageName}'`);
    
    console.log('Backup image exists:', !!capturedImageBackup.current);
    addDebugLog(`💾 backup: ${capturedImageBackup.current ? 'EXISTS' : 'NULL'}`);
    
    console.log('Temp image exists:', !!tempImageData);
    addDebugLog(`🔄 tempImageData: ${tempImageData ? 'EXISTS' : 'NULL'}`);
    
    // Validate image name first
    if (!imageName || !imageName.trim()) {
      console.error('Image name is required for cropping');
      addDebugLog('❌ ERROR: No image name provided');
      alert('Please enter a name for the treasure marker before cropping.');
      return;
    }
    addDebugLog(`✅ Image name validated: '${imageName.trim()}'`);
    
    // Try to recover from multiple backup sources if main state is lost
    const imageToUse = capturedImage || capturedImageBackup.current || tempImageData;
    addDebugLog(`🔍 Image selection: ${imageToUse ? 'FOUND' : 'NONE'}`);
    
    if (!imageToUse || !canvasRef.current) {
      console.error('Missing capturedImage or canvasRef for cropping');
      addDebugLog('💥 CRITICAL ERROR: Missing image data or canvas');
      addDebugLog(`capturedImage: ${capturedImage ? 'EXISTS' : 'NULL'}`);
      addDebugLog(`backup: ${capturedImageBackup.current ? 'EXISTS' : 'NULL'}`);
      addDebugLog(`tempImageData: ${tempImageData ? 'EXISTS' : 'NULL'}`);
      addDebugLog(`canvasRef: ${canvasRef.current ? 'EXISTS' : 'NULL'}`);
      
      console.error('capturedImage:', capturedImage ? 'exists' : 'null');
      console.error('capturedImageBackup:', capturedImageBackup.current ? 'exists' : 'null');
      console.error('tempImageData:', tempImageData ? 'exists' : 'null');
      console.error('canvasRef.current:', canvasRef.current ? 'exists' : 'null');
      alert('Missing image data for cropping. Please capture an image first.');
      return;
    }
    addDebugLog('✅ All required data available for cropping');
    
    // Restore all image states if any are missing
    if (!capturedImage && imageToUse) {
      console.log('⚠️ Restoring image from backup sources');
      addDebugLog('🔄 Restoring capturedImage from backup');
      setCapturedImage(imageToUse);
    }
    if (!capturedImageBackup.current && imageToUse) {
      addDebugLog('🔄 Restoring capturedImageBackup.current');
      capturedImageBackup.current = imageToUse;
    }
    if (!tempImageData && imageToUse) {
      addDebugLog('🔄 Restoring tempImageData');
      setTempImageData(imageToUse);
    }
    
    console.log('Starting crop operation...');
    console.log('Crop area:', cropArea);
    console.log('Image dimensions:', imageDimensions);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      alert('Canvas error. Please refresh the page and try again.');
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      try {
        console.log('Image loaded for cropping:', {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          imageDimensions: imageDimensions
        });
        
        // Check if image dimensions are valid
        if (imageDimensions.width === 0 || imageDimensions.height === 0) {
          console.warn('Invalid image dimensions, using natural size');
          const scaleX = 1;
          const scaleY = 1;
          
          const actualCropX = cropArea.x;
          const actualCropY = cropArea.y;
          const actualCropWidth = cropArea.width;
          const actualCropHeight = cropArea.height;
          
          // Set canvas to crop size
          canvas.width = actualCropWidth;
          canvas.height = actualCropHeight;
          
          // Draw cropped portion
          ctx.drawImage(
            img,
            actualCropX, actualCropY, actualCropWidth, actualCropHeight,
            0, 0, actualCropWidth, actualCropHeight
          );
        } else {
          // Use actual image dimensions for cropping
          const scaleX = img.naturalWidth / imageDimensions.width;
          const scaleY = img.naturalHeight / imageDimensions.height;
          
          const actualCropX = cropArea.x * scaleX;
          const actualCropY = cropArea.y * scaleY;
          const actualCropWidth = cropArea.width * scaleX;
          const actualCropHeight = cropArea.height * scaleY;
          
          console.log('Actual crop dimensions:', {
            x: actualCropX,
            y: actualCropY,
            width: actualCropWidth,
            height: actualCropHeight,
            scaleX,
            scaleY
          });
          
          // Set canvas to crop size
          canvas.width = actualCropWidth;
          canvas.height = actualCropHeight;
          
          // Draw cropped portion
          ctx.drawImage(
            img,
            actualCropX, actualCropY, actualCropWidth, actualCropHeight,
            0, 0, actualCropWidth, actualCropHeight
          );
        }
        
        // Get cropped image data
        const croppedData = canvas.toDataURL('image/png');
        setCroppedImage(croppedData);
        
        console.log('Crop complete, proceeding to processing...');
        
        // Proceed to processing
        setCurrentStep('processing');
        validateAndUploadImage(croppedData, imageName);
        
      } catch (error) {
        console.error('Error during crop operation:', error);
        alert('Failed to crop image. Please try again.');
      }
    };
    
    img.onerror = (error) => {
      console.error('Failed to load image for cropping:', error);
      alert('Failed to load image for cropping. Please try again.');
    };
    
    img.src = imageToUse;
  };
  
  const recaptureImage = () => {
    addDebugLog('🔄 RECAPTURE: Clearing all image data');
    setCapturedImage(null);
    setCroppedImage(null);
    capturedImageBackup.current = null; // Clear backup too
    setTempImageData(null); // Clear temp backup
    setImageName('');
    setIsNamingImage(false);
    setCurrentStep('capture');
    addDebugLog('🔄 RECAPTURE: Moved back to capture step');
  };

  const validateAndUploadImage = async (imageData: string, name: string) => {
    setIsProcessing(true);
    
    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Create form data
      const formData = new FormData();
      formData.append('image', blob, `${name}.png`);
      formData.append('imageName', name);
      formData.append('latitude', currentLocation?.latitude.toString() || '0');
      formData.append('longitude', currentLocation?.longitude.toString() || '0');
      
      // Validate with ARCore and upload
      const validationResponse = await fetch('/api/validate-and-upload-image', {
        method: 'POST',
        body: formData,
      });
      
      const result = await validationResponse.json();
      
      if (result.success && result.score && result.score > config.arcore.minValidationScore) {
        setValidationScore(result.score);
        
        // Create partial treasure data
        setCurrentTreasure({
          imageName: `clue_${treasureCount}_${name.toLowerCase().replace(/\s+/g, '_')}`,
          fileName: `${name}.png`,
          physicalSizeInMeters: 0.15,
          clueIndex: treasureCount,
          clueName: name,
          spawnOffset: { x: 0, y: 0, z: 0 },
          spawnRotation: { x: 0, y: 0, z: 0 },
          latitude: currentLocation?.latitude || 0,
          longitude: currentLocation?.longitude || 0,
        });
        
        setCurrentStep('clue-builder');
      } else {
        alert(`Image validation failed. Score: ${result.score || 'Unknown'}. Please capture a new image with more visual features.`);
        setCurrentStep('capture');
      }
    } catch (error) {
      console.error('Image validation failed:', error);
      alert('Failed to process image. Please try again.');
      setCurrentStep('capture');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSecretCode = () => {
    const codes = ['LIFT123', 'TREAS456', 'HUNT789', 'CLUE012', 'FIND345', 'SEEK678', 'GOLD901'];
    const randomCode = codes[Math.floor(Math.random() * codes.length)];
    setSecretCode(randomCode + treasureCount);
  };

  const saveClueAndContinue = async () => {
    if (!currentTreasure || !clueText.trim()) {
      alert('Please enter clue text before continuing.');
      return;
    }
    
    const completeTreasure: TreasureData = {
      ...currentTreasure as TreasureData,
      clueText: clueText.trim(),
      hasPhysicalGame,
      physicalGameInstruction: hasPhysicalGame ? physicalInstruction : '',
      physicalGameSecretCode: hasPhysicalGame ? secretCode : '',
      storyAssetIndex: treasureCount // This will be overridden by the API with proper sequential indexing
    };
    
    const newTreasures = [...treasures, completeTreasure];
    setTreasures(newTreasures);
    
    // Update web config file with storyline and treasures
    try {
      await fetch('/api/update-web-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          treasures: newTreasures,
          storyline: selectedStoryline
        })
      });
    } catch (error) {
      console.error('Failed to update web config:', error);
    }
    
    const newCount = treasureCount + 1;
    setTreasureCount(newCount);
    
    if (newCount >= maxTreasures) {
      setCurrentStep('complete');
    } else {
      // Ask if user wants to continue
      const continueHiding = confirm('Treasure saved successfully! Do you want to hide another treasure?');
      if (continueHiding) {
        resetForNextTreasure();
        setCurrentStep('capture');
      } else {
        setCurrentStep('complete');
      }
    }
  };

  const resetForNextTreasure = () => {
    setCapturedImage(null);
    setCroppedImage(null);
    capturedImageBackup.current = null; // Clear backup too
    setTempImageData(null); // Clear temp backup
    setImageName('');
    setIsNamingImage(false);
    setValidationScore(null);
    setCurrentTreasure(null);
    setClueText('');
    setHasPhysicalGame(false);
    setPhysicalInstruction('');
    setSecretCode('');
    // Don't reset treasureCount here - it should accumulate
  };

  const endSession = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCurrentStep('complete');
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const instructionsContent = `
    **Image Quality Guidelines for AR Tracking:**
    
    ✅ **Good Images:**
    • Rich in detail with unique features (street signs, artwork, detailed posters)
    • High contrast between light and dark areas
    • Sharp focus with clear textures
    • Unique patterns and shapes
    
    ❌ **Avoid:**
    • Blank walls or featureless surfaces
    • Repetitive patterns (brick walls, carpet)
    • Shiny or reflective surfaces
    • Blurry or low-contrast images
    
    **Tips:**
    • Aim for images with lots of corners, edges, and unique details
    • Ensure good lighting for clear contrast
    • Keep the camera steady for sharp images
    • Look for objects with text, logos, or distinctive artwork
  `;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="color-scheme" content="light only" />
      </Head>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          background: linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #CD853F 100%);
          min-height: 100vh;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          background: linear-gradient(135deg, rgba(139,69,19,0.95) 0%, rgba(160,82,45,0.95) 100%);
          color: white;
          padding: 2rem;
          border-radius: 20px;
          text-align: center;
          margin-bottom: 2rem;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          position: relative;
        }

        .treasure-counter {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255,215,0,0.9);
          color: #8B4513;
          padding: 0.5rem 1rem;
          border-radius: 25px;
          font-weight: bold;
          font-size: 1rem;
        }

        .instructions-toggle {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.3);
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.2rem;
        }

        .instructions-panel {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .instructions-content {
          background: white;
          padding: 2rem;
          border-radius: 15px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }

        .close-instructions {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: #e74c3c;
          color: white;
          border: none;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-content {
          background: white;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          margin-bottom: 2rem;
        }

        .camera-container {
          position: relative;
          width: 100%;
          height: 50vh;
          background: #000;
          border-radius: 15px;
          overflow: hidden;
          margin-bottom: 2rem;
        }

        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border: 2px dashed #FFD700;
          width: 200px;
          height: 200px;
          border-radius: 15px;
          pointer-events: none;
        }

        .capture-button {
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          color: #8B4513;
          border: none;
          padding: 1rem 2rem;
          border-radius: 50px;
          font-size: 1.2rem;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 8px 25px rgba(255,215,0,0.3);
          transition: all 0.3s ease;
          width: 100%;
          margin-top: 1rem;
        }

        .capture-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(255,215,0,0.4);
        }

        .btn {
          padding: 1rem 2rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin: 0.5rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(139,69,19,0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(139,69,19,0.4);
        }

        .btn-success {
          background: linear-gradient(135deg, #228B22 0%, #32CD32 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(34,139,34,0.3);
        }

        .btn-danger {
          background: linear-gradient(135deg, #DC143C 0%, #B22222 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(220,20,60,0.3);
        }

        .clue-builder {
          display: grid;
          gap: 2rem;
          margin-top: 2rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-weight: bold;
          color: #8B4513;
          font-size: 1.1rem;
        }

        .form-input, .form-textarea {
          padding: 1rem;
          border: 2px solid #D2691E;
          border-radius: 10px;
          font-size: 1rem;
          transition: border-color 0.3s ease;
        }

        .form-input:focus, .form-textarea:focus {
          border-color: #8B4513;
          outline: none;
          box-shadow: 0 0 10px rgba(139,69,19,0.2);
        }

        .form-textarea {
          min-height: 120px;
          resize: vertical;
        }

        .toggle-section {
          background: linear-gradient(135deg, #F4A460 0%, #DEB887 100%);
          padding: 1.5rem;
          border-radius: 15px;
          margin: 1rem 0;
        }

        .toggle-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .toggle-switch {
          position: relative;
          width: 60px;
          height: 30px;
          background: #ccc;
          border-radius: 30px;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .toggle-switch.active {
          background: #32CD32;
        }

        .toggle-slider {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 26px;
          height: 26px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s ease;
        }

        .toggle-switch.active .toggle-slider {
          transform: translateX(30px);
        }

        .validation-result {
          background: linear-gradient(135deg, #32CD32 0%, #228B22 100%);
          color: white;
          padding: 1.5rem;
          border-radius: 15px;
          text-align: center;
          margin: 1rem 0;
        }

        .processing-spinner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #8B4513;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .completion-celebration {
          text-align: center;
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          color: #8B4513;
          padding: 3rem;
          border-radius: 20px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        }

        .hidden {
          display: none;
        }

        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }
          
          .camera-container {
            height: 40vh;
          }
          
          .clue-builder {
            gap: 1rem;
          }
          
          .btn {
            padding: 0.75rem 1.5rem;
            font-size: 0.9rem;
          }
        }
      `}</style>

      <Layout title="Hide the Treasures - AR Treasure Hunt Setup">
        <div className="container">
          {/* Header */}
          <div className="header">
            <button 
              className="instructions-toggle"
              onClick={() => setShowInstructions(true)}
            >
              i
            </button>

            <button 
              className="instructions-toggle"
              onClick={() => window.location.href = '/treasure-dashboard'}
              style={{ left: '60px', background: 'rgba(34,139,34,0.8)', borderColor: 'rgba(34,139,34,0.5)' }}
              title="Go to Treasure Dashboard"
            >
              🏴‍☠️
            </button>
            
            <div className="treasure-counter">
              🏴‍☠️ {treasureCount} / {maxTreasures} Treasures Hidden
            </div>

            <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', fontWeight: 'bold' }}>
              🗺️ HIDE THE TREASURES
            </h1>
            <p style={{ margin: '0', fontSize: '1.2rem', opacity: 0.9 }}>
              Frontman Interface - Set up AR treasure hunt markers
            </p>
          </div>

          {/* Instructions Panel */}
          {showInstructions && (
            <div className="instructions-panel">
              <div className="instructions-content">
                <button 
                  className="close-instructions"
                  onClick={() => setShowInstructions(false)}
                >
                  ×
                </button>
                <h3 style={{ color: '#8B4513', marginTop: 0 }}>📸 Image Capture Guidelines</h3>
                <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                  {instructionsContent}
                </div>
              </div>
            </div>
          )}

          {/* Hidden Canvas - Always available for image processing */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Step Content */}
          <div className="step-content">
            {/* Storyline Selection Step */}
            {currentStep === 'storyline-selection' && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#8B4513', fontSize: '2.5rem', marginBottom: '1rem' }}>
                  📖 Choose Your Adventure Story
                </h2>
                <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '3rem' }}>
                  Select the storyline theme for your treasure hunt adventure. This determines the 3D assets and atmosphere of your AR experience.
                </p>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: '2rem',
                  marginBottom: '3rem',
                  maxWidth: '1000px',
                  margin: '0 auto 3rem auto'
                }}>
                  {availableStorylines.map((storyline) => (
                    <div 
                      key={storyline.selectedStory}
                      onClick={() => updateStorylineSelection(storyline.selectedStory)}
                      style={{
                        background: selectedStoryline.selectedStory === storyline.selectedStory 
                          ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' 
                          : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                        border: selectedStoryline.selectedStory === storyline.selectedStory 
                          ? '3px solid #8B4513' 
                          : '2px solid #ddd',
                        borderRadius: '20px',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedStoryline.selectedStory === storyline.selectedStory
                          ? '0 15px 35px rgba(139,69,19,0.3)'
                          : '0 5px 15px rgba(0,0,0,0.1)',
                        transform: selectedStoryline.selectedStory === storyline.selectedStory
                          ? 'translateY(-5px)'
                          : 'translateY(0)',
                      }}
                    >
                      <div style={{
                        fontSize: '3rem',
                        marginBottom: '1rem',
                        filter: selectedStoryline.selectedStory === storyline.selectedStory ? 'none' : 'grayscale(50%)'
                      }}>
                        {storyline.selectedStory === 'Story1_PirateAdventure_Assets' && '🏴‍☠️'}
                        {storyline.selectedStory === 'Story2_AncientEgypt_Assets' && '🏛️'}
                        {storyline.selectedStory === 'Story3_SpaceExplorer_Assets' && '🚀'}
                      </div>
                      <h3 style={{ 
                        color: selectedStoryline.selectedStory === storyline.selectedStory ? '#8B4513' : '#666', 
                        fontSize: '1.5rem', 
                        marginBottom: '1rem',
                        fontWeight: 'bold'
                      }}>
                        {storyline.storyTitle}
                      </h3>
                      <p style={{ 
                        color: selectedStoryline.selectedStory === storyline.selectedStory ? '#8B4513' : '#666', 
                        fontSize: '1rem',
                        lineHeight: '1.5',
                        margin: '0'
                      }}>
                        {storyline.storyDescription}
                      </p>
                      {selectedStoryline.selectedStory === storyline.selectedStory && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.5rem 1rem',
                          background: 'rgba(139,69,19,0.2)',
                          borderRadius: '25px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          color: '#8B4513'
                        }}>
                          ✅ SELECTED
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{
                  background: 'rgba(139,69,19,0.1)',
                  padding: '2rem',
                  borderRadius: '15px',
                  marginBottom: '2rem',
                  textAlign: 'left'
                }}>
                  <h4 style={{ color: '#8B4513', fontSize: '1.2rem', marginBottom: '1rem' }}>
                    ⚠️ Important: Sequential Setup Process
                  </h4>
                  <div style={{ color: '#666', lineHeight: '1.6' }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Step 1:</strong> Select your storyline theme (this step)
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Step 2:</strong> Configure treasure hunt settings
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      <strong>Step 3:</strong> Capture and hide treasure markers
                    </p>
                    <p style={{ margin: '0', fontStyle: 'italic', color: '#8B4513' }}>
                      Once you save your storyline selection, the mobile app will know which 3D assets to download for your adventure!
                    </p>
                  </div>
                </div>

                <button 
                  className="btn btn-success"
                  onClick={saveStorylineAndProceed}
                  style={{ 
                    fontSize: '1.3rem', 
                    padding: '1.5rem 3rem',
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                  }}
                >
                  💾 Save Storyline & Continue
                </button>

                <p style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.9rem', 
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  This will update your treasure hunt configuration and allow you to proceed to the next step.
                </p>
              </div>
            )}

            {/* Setup Step */}
            {currentStep === 'setup' && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#8B4513', fontSize: '2rem', marginBottom: '2rem' }}>
                  🎯 Ready to Hide Treasures?
                </h2>
                
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
                    padding: '1.5rem',
                    borderRadius: '15px',
                    textAlign: 'center',
                    border: '2px solid #4caf50'
                  }}>
                    <h4 style={{ color: '#2e7d32', margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>
                      🎯 Available Assets for {selectedStoryline.storyTitle}
                    </h4>
                    <div style={{ fontSize: '2rem', color: '#2e7d32', fontWeight: 'bold' }}>
                      {availableAssets} images ready to be captured
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#2e7d32', fontSize: '0.9rem' }}>
                      Your storyline bundle contains {availableAssets} preset assets that can be spawned in AR
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    padding: '1.5rem',
                    borderRadius: '15px',
                    color: '#8B4513',
                    textAlign: 'center'
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>
                      🌟 Selected Story: {selectedStoryline.storyTitle}
                    </h4>
                    <p style={{ margin: '0', fontSize: '1rem', fontStyle: 'italic' }}>
                      {selectedStoryline.storyDescription}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.8 }}>
                      ✅ Config updated successfully
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '10px' }}>
                  <p style={{ margin: '0.5rem 0', color: gpsPermission ? '#228B22' : '#DC143C' }}>
                    📍 GPS Access: {gpsPermission ? '✅ Granted' : '❌ Required'}
                  </p>
                  {currentLocation && (
                    <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                      Current Location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                    </p>
                  )}
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={startHidingTreasures}
                  disabled={!gpsPermission}
                  style={{ fontSize: '1.3rem', padding: '1.5rem 3rem' }}
                >
                  🚀 Start Hunt
                </button>

                {!gpsPermission && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      console.log('Bypassing GPS for camera test');
                      setGpsPermission(true);
                      setCurrentLocation({ latitude: 0, longitude: 0 });
                    }}
                    style={{ fontSize: '1rem', padding: '1rem 2rem', background: '#e17055' }}
                  >
                    🔧 Skip GPS & Test Camera
                  </button>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={testCameraAccess}
                    style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem', background: '#00b894' }}
                  >
                    📹 Test Camera
                  </button>
                  
                  <button 
                    className="btn btn-primary"
                    onClick={diagnoseCameraIssues}
                    style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem' }}
                  >
                    🔧 Camera Diagnostics
                  </button>
                </div>

                {!gpsPermission && (
                  <p style={{ marginTop: '1rem', color: '#DC143C' }}>
                    Please allow location access to continue
                  </p>
                )}

                <div style={{ 
                  marginTop: '2rem', 
                  padding: '1rem', 
                  background: '#f8f9fa', 
                  borderRadius: '10px',
                  fontSize: '0.9rem'
                }}>
                  <h4 style={{ color: '#8B4513', margin: '0 0 0.5rem 0' }}>📱 Mobile Camera Tips:</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#666' }}>
                    <li><strong>Use Chrome or Safari</strong> - Best mobile camera support</li>
                    <li><strong>Allow camera permission</strong> - Required for image capture</li>
                    <li><strong>Use HTTPS</strong> - Camera only works on secure connections</li>
                    <li><strong>Close other camera apps</strong> - Only one app can use camera at a time</li>
                    <li><strong>Try landscape mode</strong> - Sometimes fixes black screen issues</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Image Capture Step */}
            {currentStep === 'capture' && (
              <div>
                <h2 style={{ color: '#8B4513', textAlign: 'center', marginBottom: '2rem' }}>
                  📷 Capture Treasure Marker #{treasureCount + 1}
                </h2>

                <div className="camera-container">
                  <video 
                    ref={videoRef}
                    className="camera-video"
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      backgroundColor: '#000'
                    }}
                    onClick={(e) => {
                      // Handle mobile tap to play
                      if (e.currentTarget.paused) {
                        console.log('User tapped to play video');
                        e.currentTarget.play().catch(err => console.warn('Manual play failed:', err));
                      }
                    }}
                  />
                  <div className="camera-overlay" />
                  
                  
                  {/* Show loading message if no camera stream yet */}
                  {!cameraStream && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0,0,0,0.9)',
                      color: 'white',
                      padding: '1.5rem',
                      borderRadius: '15px',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      zIndex: 10,
                      maxWidth: '300px'
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                      <div>Camera not initialized</div>
                      <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
                        Click "Retry Camera" below
                      </div>
                    </div>
                  )}
                  
                  {/* Debug info for mobile */}
                  {process.env.NODE_ENV === 'development' && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '5px',
                      fontSize: '12px',
                      borderRadius: '4px'
                    }}>
                      Stream: {cameraStream ? '✅' : '❌'} | 
                      Video: {videoRef.current?.readyState || 'N/A'} |
                      Size: {videoRef.current?.videoWidth || 0}x{videoRef.current?.videoHeight || 0}
                    </div>
                  )}
                </div>

                <button 
                  className="capture-button"
                  onClick={captureImage}
                  disabled={!cameraStream}
                >
                  📸 Capture Marker Image
                </button>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  {!cameraStream && (
                    <button 
                      className="btn btn-primary"
                      onClick={startHidingTreasures}
                    >
                      🔄 Retry Camera
                    </button>
                  )}
                  
                  {cameraStream && (
                    <>
                      <button 
                        className="btn btn-primary"
                        onClick={refreshVideoFeed}
                      >
                        🔄 Refresh Video
                      </button>
                      
                      <button 
                        className="btn btn-primary"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.play().catch(e => console.warn('Manual play failed:', e));
                          }
                        }}
                      >
                        ▶️ Force Play
                      </button>
                      
                      <button 
                        className="btn btn-primary"
                        onClick={diagnoseCameraIssues}
                      >
                        🔧 Debug
                      </button>
                    </>
                  )}
                  
                  <button className="btn btn-danger" onClick={endSession}>
                    🛑 End Session
                  </button>
                </div>

                {/* Camera troubleshooting info */}
                {cameraStream && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'rgba(139, 69, 19, 0.1)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    color: '#8B4513'
                  }}>
                    <strong>📱 Camera Troubleshooting:</strong>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                      <li><strong>Black Screen?</strong> Try "🔄 Refresh Video" then "▶️ Force Play"</li>
                      <li><strong>Still Black?</strong> Switch to landscape mode or reload page</li>
                      <li><strong>Permission Issues?</strong> Check browser settings and allow camera</li>
                      <li><strong>Not Working?</strong> Close other camera apps and try again</li>
                      <li><strong>Need Details?</strong> Use "🔧 Debug" and check browser console (F12)</li>
                    </ul>
                    
                    {/* Live status indicators */}
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.5)',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace'
                    }}>
                      <strong>Status:</strong><br/>
                      Camera Stream: {cameraStream ? '✅ Active' : '❌ None'}<br/>
                      Video Ready: {videoRef.current?.readyState === 4 ? '✅ Yes' : `❌ State ${videoRef.current?.readyState || 0}`}<br/>
                      Video Size: {videoRef.current?.videoWidth || 0} × {videoRef.current?.videoHeight || 0}<br/>
                      Playing: {videoRef.current?.paused === false ? '✅ Yes' : '❌ Paused'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image Cropping Step */}
            {currentStep === 'crop' && (
              <div>
                <h2 style={{ color: '#8B4513', textAlign: 'center', marginBottom: '2rem' }}>
                  ✂️ Crop Your Marker Image
                </h2>
                
                {/* Image Naming Section */}
                {isNamingImage && (
                  <div style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    padding: '2rem',
                    borderRadius: '15px',
                    marginBottom: '2rem',
                    textAlign: 'center'
                  }}>
                    <h3 style={{ color: '#8B4513', marginBottom: '1rem' }}>📝 Name Your Treasure Marker</h3>
                    <input
                      type="text"
                      value={imageName}
                      onChange={(e) => setImageName(e.target.value)}
                      placeholder="Enter a name for this treasure marker..."
                      className="form-input"
                      style={{ maxWidth: '400px', marginBottom: '1rem' }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && imageName.trim()) {
                          setIsNamingImage(false);
                        }
                      }}
                      autoFocus
                    />
                    <div>
                      <button
                        className="btn btn-success"
                        onClick={() => {
                          if (imageName.trim()) {
                            addDebugLog(`✅ Name confirmed: '${imageName.trim()}'`);
                            setIsNamingImage(false);
                          } else {
                            addDebugLog('❌ Name confirmation failed: empty name');
                            alert('Please enter a name for the treasure marker.');
                          }
                        }}
                        disabled={!imageName.trim()}
                        style={{ marginRight: '1rem' }}
                      >
                        ✅ Confirm Name
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={recaptureImage}
                      >
                        🔄 Retake Photo
                      </button>
                    </div>
                  </div>
                )}
                
                {!isNamingImage && (
                  <>
                    <div style={{
                      background: '#f8f9fa',
                      padding: '1rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      textAlign: 'center'
                    }}>
                      <strong>Treasure Name:</strong> {imageName}
                      <button
                        onClick={() => setIsNamingImage(true)}
                        style={{
                          marginLeft: '1rem',
                          background: 'none',
                          border: '1px solid #8B4513',
                          color: '#8B4513',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                    
                    <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
                      Adjust the crop area to focus on your marker. Make sure it contains rich visual details for better AR tracking.
                    </p>
                  </>
                )}
                
                {/* Enhanced Debug Panel - Real-time monitoring */}
                <div style={{ 
                  background: '#e8f4f8', 
                  border: '2px solid #2196F3',
                  padding: '1rem', 
                  marginBottom: '1rem', 
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <strong style={{ color: '#1976D2', fontSize: '1rem' }}>🔍 REAL-TIME DEBUG MONITOR</strong>
                    <button 
                      onClick={() => setDebugLog([])}
                      style={{
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.7rem'
                      }}
                    >
                      Clear Log
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <strong style={{ color: '#1976D2' }}>📊 Current State:</strong><br/>
                      <span style={{ color: capturedImage ? '#4CAF50' : '#f44336' }}>
                        Captured Image: {capturedImage ? `✅ ${capturedImage.length} chars` : '❌ Missing'}
                      </span><br/>
                      <span style={{ color: capturedImageBackup.current ? '#4CAF50' : '#f44336' }}>
                        Backup Image: {capturedImageBackup.current ? `✅ ${capturedImageBackup.current.length} chars` : '❌ Missing'}
                      </span><br/>
                      <span style={{ color: tempImageData ? '#4CAF50' : '#f44336' }}>
                        Temp Image: {tempImageData ? `✅ ${tempImageData.length} chars` : '❌ Missing'}
                      </span><br/>
                      <span style={{ color: canvasRef.current ? '#4CAF50' : '#f44336' }}>
                        Canvas Ref: {canvasRef.current ? '✅ Present' : '❌ Missing'}
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: '#1976D2' }}>📝 Form Data:</strong><br/>
                      Image Name: <span style={{ color: imageName ? '#4CAF50' : '#f44336' }}>'{imageName || 'None'}'</span><br/>
                      Naming Mode: <span style={{ color: isNamingImage ? '#FF9800' : '#4CAF50' }}>{isNamingImage ? '⚠️ Active' : '✅ Complete'}</span><br/>
                      Current Step: <span style={{ color: '#2196F3' }}>{currentStep}</span><br/>
                      Crop Area: {cropArea.width}×{cropArea.height} at ({cropArea.x},{cropArea.y})
                    </div>
                  </div>
                  
                  <div>
                    <strong style={{ color: '#1976D2' }}>📜 Activity Log (Recent → Older):</strong>
                    <div style={{ 
                      maxHeight: '150px', 
                      overflowY: 'auto', 
                      background: '#fff', 
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      marginTop: '0.5rem',
                      border: '1px solid #ddd'
                    }}>
                      {debugLog.length === 0 ? (
                        <div style={{ color: '#666', fontStyle: 'italic' }}>No activity yet... capture an image to start</div>
                      ) : (
                        debugLog.map((log, idx) => (
                          <div key={idx} style={{ 
                            padding: '2px 0', 
                            borderBottom: idx < debugLog.length - 1 ? '1px solid #eee' : 'none',
                            fontSize: '0.8rem'
                          }}>
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ position: 'relative', maxWidth: '100%', margin: '0 auto' }}>
                  {capturedImage && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img 
                        ref={imageRef}
                        src={capturedImage} 
                        alt="Captured" 
                        onLoad={handleImageLoad}
                        style={{ 
                          maxWidth: '100%', 
                          height: 'auto',
                          border: '2px solid #8B4513',
                          borderRadius: '10px'
                        }}
                      />
                      
                      {/* Crop overlay */}
                      <div 
                        style={{
                          position: 'absolute',
                          left: `${(cropArea.x / imageDimensions.width) * 100}%`,
                          top: `${(cropArea.y / imageDimensions.height) * 100}%`,
                          width: `${(cropArea.width / imageDimensions.width) * 100}%`,
                          height: `${(cropArea.height / imageDimensions.height) * 100}%`,
                          border: '3px solid #FFD700',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 215, 0, 0.2)',
                          cursor: 'move',
                          minWidth: '50px',
                          minHeight: '50px'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startCropX = cropArea.x;
                          const startCropY = cropArea.y;
                          
                          const handleMouseMove = (moveE: MouseEvent) => {
                            const deltaX = moveE.clientX - startX;
                            const deltaY = moveE.clientY - startY;
                            const scaleX = imageDimensions.width / rect.width;
                            const scaleY = imageDimensions.height / rect.height;
                            
                            setCropArea(prev => ({
                              ...prev,
                              x: Math.max(0, Math.min(imageDimensions.width - prev.width, startCropX + deltaX * scaleX)),
                              y: Math.max(0, Math.min(imageDimensions.height - prev.height, startCropY + deltaY * scaleY))
                            }));
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                          const touch = e.touches[0];
                          const startX = touch.clientX;
                          const startY = touch.clientY;
                          const startCropX = cropArea.x;
                          const startCropY = cropArea.y;
                          
                          const handleTouchMove = (moveE: TouchEvent) => {
                            moveE.preventDefault();
                            const moveTouch = moveE.touches[0];
                            const deltaX = moveTouch.clientX - startX;
                            const deltaY = moveTouch.clientY - startY;
                            const scaleX = imageDimensions.width / rect.width;
                            const scaleY = imageDimensions.height / rect.height;
                            
                            setCropArea(prev => ({
                              ...prev,
                              x: Math.max(0, Math.min(imageDimensions.width - prev.width, startCropX + deltaX * scaleX)),
                              y: Math.max(0, Math.min(imageDimensions.height - prev.height, startCropY + deltaY * scaleY))
                            }));
                          };
                          
                          const handleTouchEnd = () => {
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                          };
                          
                          document.addEventListener('touchmove', handleTouchMove, { passive: false });
                          document.addEventListener('touchend', handleTouchEnd);
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          bottom: '-5px',
                          right: '-5px',
                          width: '15px',
                          height: '15px',
                          backgroundColor: '#FFD700',
                          cursor: 'se-resize',
                          borderRadius: '3px'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startWidth = cropArea.width;
                          const startHeight = cropArea.height;
                          
                          const handleMouseMove = (moveE: MouseEvent) => {
                            const deltaX = moveE.clientX - startX;
                            const deltaY = moveE.clientY - startY;
                            const scaleX = imageDimensions.width / rect.width;
                            const scaleY = imageDimensions.height / rect.height;
                            
                            setCropArea(prev => ({
                              ...prev,
                              width: Math.max(50, Math.min(imageDimensions.width - prev.x, startWidth + deltaX * scaleX)),
                              height: Math.max(50, Math.min(imageDimensions.height - prev.y, startHeight + deltaY * scaleY))
                            }));
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                          const touch = e.touches[0];
                          const startX = touch.clientX;
                          const startY = touch.clientY;
                          const startWidth = cropArea.width;
                          const startHeight = cropArea.height;
                          
                          const handleTouchMove = (moveE: TouchEvent) => {
                            moveE.preventDefault();
                            const moveTouch = moveE.touches[0];
                            const deltaX = moveTouch.clientX - startX;
                            const deltaY = moveTouch.clientY - startY;
                            const scaleX = imageDimensions.width / rect.width;
                            const scaleY = imageDimensions.height / rect.height;
                            
                            setCropArea(prev => ({
                              ...prev,
                              width: Math.max(50, Math.min(imageDimensions.width - prev.x, startWidth + deltaX * scaleX)),
                              height: Math.max(50, Math.min(imageDimensions.height - prev.y, startHeight + deltaY * scaleY))
                            }));
                          };
                          
                          const handleTouchEnd = () => {
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                          };
                          
                          document.addEventListener('touchmove', handleTouchMove, { passive: false });
                          document.addEventListener('touchend', handleTouchEnd);
                        }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {!isNamingImage && (
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <p style={{ color: '#666', marginBottom: '1rem' }}>
                      Drag the yellow box to move it, drag the corner to resize it
                    </p>
                    
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-success"
                        onClick={cropImage}
                        style={{ fontSize: '1.1rem' }}
                        disabled={!imageName.trim()}
                      >
                        ✂️ Crop and next
                      </button>
                      <button 
                        className="btn btn-primary"
                        onClick={recaptureImage}
                      >
                        📷 Retake Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Processing Step */}
            {currentStep === 'processing' && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#8B4513', marginBottom: '2rem' }}>
                  🔍 Processing Image...
                </h2>

                {isProcessing ? (
                  <div className="processing-spinner">
                    <div className="spinner"></div>
                    <p>Validating image with ARCore...</p>
                  </div>
                ) : (
                  validationScore !== null && (
                    <div className="validation-result">
                      <h3>✅ Validation Complete!</h3>
                      <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
                        ARCore Score: {validationScore}/100
                      </p>
                      <p>Image quality is excellent for AR tracking!</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Clue Builder Step */}
            {currentStep === 'clue-builder' && (
              <div>
                <h2 style={{ color: '#8B4513', textAlign: 'center', marginBottom: '2rem' }}>
                  ✨ Create Clue for "{currentTreasure?.clueName}"
                </h2>

                <div className="clue-builder">
                  <div className="form-group">
                    <label className="form-label">🧭 Clue Text:</label>
                    <textarea 
                      className="form-textarea"
                      value={clueText}
                      onChange={(e) => setClueText(e.target.value)}
                      placeholder="Write the clue that will guide treasure hunters to this location..."
                    />
                  </div>

                  <div className="toggle-section">
                    <div className="toggle-header">
                      <div 
                        className={`toggle-switch ${hasPhysicalGame ? 'active' : ''}`}
                        onClick={() => setHasPhysicalGame(!hasPhysicalGame)}
                      >
                        <div className="toggle-slider"></div>
                      </div>
                      <span className="form-label">🎮 Has Physical Game Challenge</span>
                    </div>

                    {hasPhysicalGame && (
                      <>
                        <div className="form-group">
                          <label className="form-label">📋 Physical Game Instructions:</label>
                          <textarea 
                            className="form-textarea"
                            value={physicalInstruction}
                            onChange={(e) => setPhysicalInstruction(e.target.value)}
                            placeholder="Describe what the team needs to do for the physical challenge..."
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">🔐 Secret Code:</label>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <input 
                              className="form-input"
                              value={secretCode}
                              onChange={(e) => setSecretCode(e.target.value)}
                              placeholder="Enter secret code..."
                            />
                            <button 
                              className="btn btn-primary"
                              onClick={generateSecretCode}
                            >
                              🎲 Generate
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                    <button 
                      className="btn btn-success"
                      onClick={saveClueAndContinue}
                      disabled={!clueText.trim()}
                    >
                      💾 Save & Continue
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={endSession}
                    >
                      🛑 End Session
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Step */}
            {currentStep === 'complete' && (
              <div className="completion-celebration">
                <h2 style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>
                  🎉 Treasure Hunt Setup Complete! 🎉
                </h2>
                <p style={{ fontSize: '1.3rem', marginBottom: '2rem' }}>
                  Successfully hidden {treasureCount} treasures with clues!
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setCurrentStep('setup');
                      setTreasureCount(0);
                      setTreasures([]);
                      resetForNextTreasure();
                    }}
                  >
                    🔄 Start New Session
                  </button>
                  <button 
                    className="btn btn-success"
                    onClick={() => window.location.href = '/'}
                  >
                    📊 Go to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}