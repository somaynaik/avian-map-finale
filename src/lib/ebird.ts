const EBIRD_API_KEY = import.meta.env.VITE_EBIRD_API_KEY || '';
const EBIRD_API_BASE = 'https://api.ebird.org/v2';

export interface BirdSighting {
  speciesCode: string;
  comName: string;
  sciName: string;
  locId: string;
  locName: string;
  obsDt: string;
  howMany: number;
  lat: number;
  lng: number;
  obsValid: boolean;
  obsReviewed: boolean;
  locationPrivate: boolean;
}

export interface RecentObservation {
  speciesCode: string;
  comName: string;
  sciName: string;
  locId: string;
  locName: string;
  obsDt: string;
  howMany: number;
  lat: number;
  lng: number;
}

/**
 * Get recent bird sightings in a region
 * @param regionCode - Region code (e.g., 'IN' for India, 'IN-DL' for Delhi)
 * @param days - Number of days back (1-30, default 14)
 */
export async function getRecentObservations(
  regionCode: string = 'IN',
  days: number = 14
): Promise<RecentObservation[]> {
  try {
    const response = await fetch(
      `${EBIRD_API_BASE}/data/obs/${regionCode}/recent?back=${days}`,
      {
        headers: {
          'X-eBirdApiToken': EBIRD_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`eBird API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching eBird data:', error);
    return [];
  }
}

/**
 * Get recent notable bird sightings in a region
 * @param regionCode - Region code (e.g., 'IN' for India)
 * @param days - Number of days back (1-30, default 14)
 */
export async function getNotableObservations(
  regionCode: string = 'IN',
  days: number = 14
): Promise<RecentObservation[]> {
  try {
    const response = await fetch(
      `${EBIRD_API_BASE}/data/obs/${regionCode}/recent/notable?back=${days}`,
      {
        headers: {
          'X-eBirdApiToken': EBIRD_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`eBird API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching notable eBird data:', error);
    return [];
  }
}

/**
 * Get recent sightings near a location
 * @param lat - Latitude
 * @param lng - Longitude
 * @param dist - Distance in kilometers (default 25)
 * @param days - Number of days back (1-30, default 14)
 */
export async function getNearbyObservations(
  lat: number,
  lng: number,
  dist: number = 25,
  days: number = 14
): Promise<RecentObservation[]> {
  try {
    const response = await fetch(
      `${EBIRD_API_BASE}/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${dist}&back=${days}`,
      {
        headers: {
          'X-eBirdApiToken': EBIRD_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`eBird API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching nearby eBird data:', error);
    return [];
  }
}

/**
 * Get recent sightings of a specific species in a region
 * @param regionCode - Region code (e.g., 'IN' for India)
 * @param speciesCode - Species code (e.g., 'bkckin3' for Black Kite)
 * @param days - Number of days back (1-30, default 14)
 */
export async function getSpeciesObservations(
  regionCode: string,
  speciesCode: string,
  days: number = 14
): Promise<RecentObservation[]> {
  try {
    const response = await fetch(
      `${EBIRD_API_BASE}/data/obs/${regionCode}/recent/${speciesCode}?back=${days}`,
      {
        headers: {
          'X-eBirdApiToken': EBIRD_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`eBird API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching species eBird data:', error);
    return [];
  }
}
