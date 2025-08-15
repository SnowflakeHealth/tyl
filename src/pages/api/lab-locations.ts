import type { APIRoute } from 'astro';

interface JunctionSlot {
  booking_key: string;
  start: string;
  end: string;
  expires_at: string | null;
  price: number;
  is_priority: boolean;
  num_appointments_available: number;
}

interface JunctionLocation {
  location: {
    lng: number;
    lat: number;
  };
  address: {
    first_line: string;
    second_line: string;
    city: string;
    state: string;
    zip_code: string;
    unit: string | null;
  };
  code: string;
  name: string;
  iana_timezone: string;
}

interface JunctionSlotEntry {
  location: JunctionLocation;
  date: string;
  slots: JunctionSlot[];
}

interface TransformedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: string;
  nextAvailable?: string;
  availability: Record<string, JunctionSlot[]>;
}

// Helper function to calculate distance between two coordinates (in miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Transform Vital API response to our format
function transformVitalResponse(
  vitalData: any,
  userLat?: number,
  userLon?: number
): TransformedLocation[] {
  // Handle both old Junction format and new Vital format
  const slotsData = vitalData.slots || vitalData.data || [];
  const locationMap = new Map<string, TransformedLocation>();

  // Group slots by location
  slotsData.forEach((entry: JunctionSlotEntry) => {
    const locationKey = entry.location.code;
    
    if (!locationMap.has(locationKey)) {
      // Format address
      const addressParts = [
        entry.location.address.first_line,
        entry.location.address.unit || entry.location.address.second_line,
        `${entry.location.address.city}, ${entry.location.address.state} ${entry.location.address.zip_code}`
      ].filter(Boolean);

      const location: TransformedLocation = {
        id: locationKey,
        name: entry.location.name,
        address: addressParts.join(', '),
        latitude: entry.location.location.lat,
        longitude: entry.location.location.lng,
        availability: {}
      };

      // Calculate distance if user coordinates provided
      if (userLat && userLon) {
        const distanceNum = calculateDistance(
          userLat,
          userLon,
          entry.location.location.lat,
          entry.location.location.lng
        );
        location.distance = distanceNum.toFixed(1) + ' miles';
      }

      locationMap.set(locationKey, location);
    }

    const location = locationMap.get(locationKey)!;
    
    // Add slots for this date
    if (entry.slots.length > 0) {
      location.availability[entry.date] = entry.slots;
      
      // Update next available if this is the earliest slot
      if (!location.nextAvailable && entry.slots.length > 0) {
        const firstSlot = entry.slots[0];
        location.nextAvailable = new Date(firstSlot.start).toLocaleString();
      }
    }
  });

  // Convert to array and sort by distance if available
  const locations = Array.from(locationMap.values());
  if (userLat && userLon) {
    locations.sort((a, b) => {
      const distA = a.distance ? parseFloat(a.distance) : 999;
      const distB = b.distance ? parseFloat(b.distance) : 999;
      return distA - distB;
    });
  }

  return locations;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get request body if provided
    const body = await request.json().catch(() => ({}));
    
    // Get geolocation from Cloudflare or request body
    const cf = (request as any).cf;
    const zipCode = body.zipCode || cf?.postalCode || '10001'; // Default to NYC
    const userLat = body.latitude || cf?.latitude || 40.7128; // NYC latitude default
    const userLon = body.longitude || cf?.longitude || -74.0060; // NYC longitude default
    const city = body.city || cf?.city || 'New York';
    const region = body.state || cf?.region || 'NY';
    
    // Get optional parameters (not used in Vital API v3, but kept for future use)
    // const startDate = body.startDate || new Date().toISOString().split('T')[0];
    // const endDate = body.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Check if we have required environment variables from Cloudflare
    // Use development key for local testing if no environment variable is set
    const JUNCTION_API_KEY = import.meta.env.JUNCTION_API_KEY || 'pk_us_rv7bFVNqK3fv5mL3W5PR_Uuo1KvPJiPeZpo18QP9ZBI';
    const JUNCTION_API_URL = import.meta.env.JUNCTION_API_URL || 'https://api.tryvital.io';

    if (!JUNCTION_API_KEY) {
      // Return error if no API key configured
      return new Response(JSON.stringify({
        error: 'API configuration missing',
        message: 'Lab location service is not configured. Please contact support.',
        locations: [],
        userLocation: {
          latitude: userLat,
          longitude: userLon,
          city: city,
          state: region,
          zipCode: zipCode
        }
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Call Vital (Junction) API
    console.log('Calling Vital API with ZIP:', zipCode);
    
    // Build query parameters - both lab and zip_code must be in query string
    const params = new URLSearchParams({
      lab: 'quest',
      zip_code: zipCode
    });
    
    const vitalResponse = await fetch(`${JUNCTION_API_URL}/v3/order/psc/appointment/availability?${params}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-vital-api-key': JUNCTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        radius: "25"
      })
    });

    if (!vitalResponse.ok) {
      const errorText = await vitalResponse.text();
      console.error('Vital API error response:', errorText);
      throw new Error(`Vital API error: ${vitalResponse.status} - ${errorText}`);
    }

    const vitalData = await vitalResponse.json();
    
    // Transform the data
    const locations = transformVitalResponse(vitalData, userLat, userLon);

    return new Response(JSON.stringify({ 
      locations,
      userLocation: {
        latitude: userLat,
        longitude: userLon,
        city: city,
        state: region,
        zipCode: zipCode
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error fetching lab locations:', error);
    
    // Try to get at least the user location info for error response
    const cf = (request as any).cf;
    const userLat = cf?.latitude || 40.7128;
    const userLon = cf?.longitude || -74.0060;
    const city = cf?.city || 'New York';
    const region = cf?.region || 'NY';
    const zipCode = cf?.postalCode || '10001';
    
    return new Response(JSON.stringify({
      error: 'Failed to fetch lab locations',
      message: error instanceof Error ? error.message : 'Unknown error',
      locations: [],
      userLocation: {
        latitude: userLat,
        longitude: userLon,
        city: city,
        state: region,
        zipCode: zipCode
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

// Handle OPTIONS for CORS
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};