// Test API endpoint to verify server connection and upload functionality
import { NextApiRequest, NextApiResponse } from 'next';
import FormData from 'form-data';

interface TestResult {
  success: boolean;
  serverUrl?: string;
  uploadEndpoint?: string;
  testMessage?: string;
  error?: string;
  serverResponse?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResult>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { config } = await import('../../config');
    
    console.log('Testing server connection...');
    console.log('Server URL:', config.server.baseUrl);
    console.log('Upload endpoint:', `${config.server.baseUrl}${config.server.endpoints.uploadImage}`);

    // Test 1: Basic server connection
    let serverReachable = false;
    let serverTestResult = '';
    
    try {
      const testResponse = await fetch(config.server.baseUrl, {
        method: 'GET',
        headers: config.server.headers,
      });
      serverReachable = true;
      serverTestResult = `Server responded with status: ${testResponse.status}`;
      console.log('Server connection test:', serverTestResult);
    } catch (testError) {
      const errorMessage = testError instanceof Error ? testError.message : String(testError);
      serverTestResult = `Server connection failed: ${errorMessage}`;
      console.error('Server connection test failed:', errorMessage);
    }

    // Test 2: Try a simple POST to upload endpoint
    let uploadTestResult = '';
    try {
      const formData = new FormData();
      formData.append('test', 'true');
      formData.append('imageName', 'test-image');
      formData.append('latitude', '0');
      formData.append('longitude', '0');
      
      const { getUploadImageUrl } = await import('../../config');
      const uploadResponse = await fetch(getUploadImageUrl(), {
        method: 'POST',
        body: formData as any, // Type assertion for Node.js FormData compatibility
        headers: {
          // Don't set Content-Type - let FormData set it with boundary
          ...config.server.headers,
          ...formData.getHeaders(),
        },
      });

      uploadTestResult = `Upload endpoint responded with status: ${uploadResponse.status}`;
      console.log('Upload test result:', uploadTestResult);
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        uploadTestResult += ` - Error: ${errorText}`;
      }
      
    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
      uploadTestResult = `Upload endpoint test failed: ${errorMessage}`;
      console.error('Upload test failed:', errorMessage);
    }

    return res.status(200).json({
      success: serverReachable,
      serverUrl: config.server.baseUrl,
      uploadEndpoint: `${config.server.baseUrl}${config.server.endpoints.uploadImage}`,
      testMessage: `Server Test: ${serverTestResult} | Upload Test: ${uploadTestResult}`,
      serverResponse: {
        serverReachable,
        serverTestResult,
        uploadTestResult
      }
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ 
      success: false, 
      error: 'Test failed with error: ' + errorMessage 
    });
  }
}