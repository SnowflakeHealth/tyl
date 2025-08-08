import type { APIRoute } from 'astro';

interface FileData {
  filename: string;
  content: string; // base64 encoded
  mimeType: string;
}

interface ExtractRequest {
  files: FileData[];
  requestId?: string;
  timestamp?: number;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  // Get environment variables from Cloudflare Worker runtime
  const runtime = (locals as any).runtime;
  const env = runtime?.env || {};
  
  // Debug logging
  console.log('Runtime object:', runtime ? 'exists' : 'undefined');
  console.log('Env object:', env ? 'exists' : 'undefined');
  console.log('Env keys:', Object.keys(env));
  
  const GCP_LAB_EXTRACT_API_KEY = env.GCP_LAB_EXTRACT_API_KEY;
  const GCP_LAB_EXTRACT_API_GATEWAY_URL = env.GCP_LAB_EXTRACT_API_GATEWAY_URL;
  
  console.log('API Key exists:', !!GCP_LAB_EXTRACT_API_KEY);
  console.log('Gateway URL exists:', !!GCP_LAB_EXTRACT_API_GATEWAY_URL);

  // CORS headers for your domains
  const allowedOrigins = [
    'https://www.trackyourlabs.com',
    'https://trackyourlabs.com',
    'http://localhost:4321',
    'http://localhost:3000'
  ];

  const origin = request.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  try {
    // Parse request body
    let body: ExtractRequest;
    try {
      body = await request.json() as ExtractRequest;
    } catch (e) {
      const errorResponse: ErrorResponse = { 
        error: 'Invalid JSON in request body' 
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate the request has files
    if (!body.files || !Array.isArray(body.files)) {
      const errorResponse: ErrorResponse = { 
        error: 'Invalid request: files array is required' 
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate file count
    if (body.files.length === 0) {
      const errorResponse: ErrorResponse = { 
        error: 'No files provided' 
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (body.files.length > 20) {
      const errorResponse: ErrorResponse = { 
        error: 'Maximum 20 files allowed' 
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate each file
    for (const file of body.files) {
      if (!file.filename || !file.content || !file.mimeType) {
        const errorResponse: ErrorResponse = { 
          error: 'Each file must have filename, content, and mimeType' 
        };
        return new Response(
          JSON.stringify(errorResponse),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Validate MIME types
      const validTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/heic',
        'image/heif'
      ];
      
      if (!validTypes.includes(file.mimeType)) {
        const errorResponse: ErrorResponse = { 
          error: `Invalid file type: ${file.mimeType}. Supported types: PDF and images.` 
        };
        return new Response(
          JSON.stringify(errorResponse),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Basic file size validation (base64 is ~1.33x original size)
      const estimatedSize = (file.content.length * 3) / 4;
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (estimatedSize > maxSize) {
        const errorResponse: ErrorResponse = { 
          error: `File ${file.filename} exceeds maximum size of 50MB` 
        };
        return new Response(
          JSON.stringify(errorResponse),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // Add request ID if not provided
    if (!body.requestId) {
      body.requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    // Add timestamp if not provided
    if (!body.timestamp) {
      body.timestamp = Date.now();
    }

    // Check if API credentials are available
    if (!GCP_LAB_EXTRACT_API_KEY || !GCP_LAB_EXTRACT_API_GATEWAY_URL) {
      console.error('Missing API credentials in environment variables');
      const errorResponse: ErrorResponse = { 
        error: 'API configuration error',
        message: 'The service is not properly configured. Please contact support.'
      };
      return new Response(
        JSON.stringify(errorResponse),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Forward the request to the API Gateway with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 290000); // 290 seconds (just under 5 minutes)
    
    let apiResponse: Response;
    try {
      apiResponse = await fetch(GCP_LAB_EXTRACT_API_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': GCP_LAB_EXTRACT_API_KEY,
          // Forward the referer for API key restrictions
          'Referer': request.headers.get('Referer') || 'https://www.trackyourlabs.com/',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('API Gateway request timeout after 290 seconds');
        const errorResponse: ErrorResponse = { 
          error: 'Request timeout',
          message: 'The processing is taking longer than expected. Please try with a smaller file or fewer pages.'
        };
        return new Response(
          JSON.stringify(errorResponse),
          {
            status: 504,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    // Get the response from the API
    const responseData = await apiResponse.text();
    
    // Try to parse as JSON, but handle text responses too
    let jsonResponse: any;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch {
      // If not JSON, wrap in an object
      jsonResponse = { 
        response: responseData,
        status: apiResponse.status 
      };
    }

    // Log for debugging (no PHI)
    console.log('Request processed:', {
      requestId: body.requestId,
      fileCount: body.files.length,
      status: apiResponse.status,
      timestamp: new Date().toISOString()
    });

    // Return the response with CORS headers
    return new Response(
      JSON.stringify(jsonResponse),
      {
        status: apiResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      }
    );
  } catch (error) {
    console.error('API error:', error);
    
    const errorResponse: ErrorResponse = { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
};

// Handle CORS preflight
export const OPTIONS: APIRoute = async ({ request }) => {
  const allowedOrigins = [
    'https://www.trackyourlabs.com',
    'https://trackyourlabs.com',
    'http://localhost:4321',
    'http://localhost:3000'
  ];

  const origin = request.headers.get('Origin') || '';
  
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};