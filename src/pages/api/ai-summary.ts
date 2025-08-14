import type { APIRoute } from 'astro';

interface FileData {
  filename: string;
  content: string; // base64 encoded
  mimeType: string;
}

interface AISummaryRequest {
  files: FileData[];
  requestId?: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  // Get environment variables from Cloudflare Worker runtime
  const runtime = (locals as any).runtime;
  const env = runtime?.env || {};
  
  const GCP_LAB_EXTRACT_API_KEY = env.GCP_LAB_EXTRACT_API_KEY;
  const GCP_LAB_EXTRACT_API_GATEWAY_URL = env.GCP_LAB_EXTRACT_API_GATEWAY_URL;

  // CORS headers for your domains
  const allowedOrigins = [
    'https://www.trackyourlabs.com',
    'https://trackyourlabs.com'
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
    let body: AISummaryRequest;
    try {
      body = await request.json() as AISummaryRequest;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
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
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: files array is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Check if API credentials are available
    if (!GCP_LAB_EXTRACT_API_KEY || !GCP_LAB_EXTRACT_API_GATEWAY_URL) {
      return new Response(
        JSON.stringify({ 
          error: 'API configuration error',
          message: 'The service is not properly configured. Please contact support.'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Always send with the correct parameters for AI summary
    const forwardBody = {
      files: body.files,
      requestId: body.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      includeAISummary: true,  // Always true for this endpoint
      requestType: 'ai-summary-only'  // Always ai-summary-only for this endpoint
    };

    console.log('AI Summary API - Forwarding to GCF with:', {
      requestType: forwardBody.requestType,
      includeAISummary: forwardBody.includeAISummary,
      filesCount: forwardBody.files.length,
      mimeTypes: forwardBody.files.map(f => f.mimeType)
    });

    // Forward the request to the API Gateway with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200000); // 20 minutes
    
    let apiResponse: Response;
    try {
      apiResponse = await fetch(GCP_LAB_EXTRACT_API_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': GCP_LAB_EXTRACT_API_KEY,
          'Referer': request.headers.get('Referer') || 'https://www.trackyourlabs.com/',
        },
        body: JSON.stringify(forwardBody),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            error: 'Request timeout',
            message: 'The AI processing is taking longer than expected. Please try again.'
          }),
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

    // Return response with CORS headers
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
    'https://trackyourlabs.com'
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