# 🐦 eBird API Integration

## Overview

Your app now displays real bird sightings from India using the eBird API! The map shows actual bird observations from the last 7 days across India.

## Features

✅ Real-time bird sightings from eBird
✅ Interactive map centered on India
✅ Click markers to see bird details
✅ Search for specific species
✅ Auto-refresh every 5 minutes
✅ Location-based navigation
✅ Beautiful UI with species info

## How It Works

### Data Source
- **API**: eBird API v2
- **Region**: India (IN)
- **Time Range**: Last 7 days
- **Update Frequency**: Every 5 minutes

### Map Features
- 🗺️ Centered on India (lat: 20.5937, lng: 78.9629)
- 📍 Bird markers show exact sighting locations
- 🔍 Search by common or scientific name
- 📱 Click "Locate" button to center on your location
- 🐦 Click any marker to see bird details

## API Endpoints Used

### Get Recent Observations
```typescript
getRecentObservations('IN', 7)
// Returns bird sightings in India from last 7 days
```

### Available Functions

```typescript
// Get recent sightings in a region
getRecentObservations(regionCode: string, days: number)

// Get notable/rare sightings
getNotableObservations(regionCode: string, days: number)

// Get sightings near a location
getNearbyObservations(lat: number, lng: number, dist: number, days: number)

// Get sightings of specific species
getSpeciesObservations(regionCode: string, speciesCode: string, days: number)
```

## Data Structure

Each bird sighting includes:

```typescript
{
  speciesCode: string;      // e.g., "bkckin3"
  comName: string;          // e.g., "Black Kite"
  sciName: string;          // e.g., "Milvus migrans"
  locId: string;            // Location ID
  locName: string;          // e.g., "Delhi, India"
  obsDt: string;            // Observation date/time
  howMany: number;          // Number of birds observed
  lat: number;              // Latitude
  lng: number;              // Longitude
}
```

## Customization

### Change Region

Edit `src/pages/MapPage.tsx`:

```typescript
// Change from India to another region
const { data: sightings = [] } = useQuery({
  queryKey: ['bird-sightings', 'US-CA'], // California
  queryFn: () => getRecentObservations('US-CA', 7),
});
```

### Region Codes
- `IN` - India
- `IN-DL` - Delhi, India
- `IN-MH` - Maharashtra, India
- `US` - United States
- `US-CA` - California
- `GB` - United Kingdom
- Full list: https://ebird.org/region/world

### Change Time Range

```typescript
// Show sightings from last 14 days instead of 7
getRecentObservations('IN', 14)
```

### Show Only Notable/Rare Birds

```typescript
import { getNotableObservations } from '@/lib/ebird';

const { data: sightings = [] } = useQuery({
  queryKey: ['notable-sightings', 'IN'],
  queryFn: () => getNotableObservations('IN', 7),
});
```

### Search Nearby Your Location

```typescript
import { getNearbyObservations } from '@/lib/ebird';

// Get sightings within 25km of a location
const { data: sightings = [] } = useQuery({
  queryKey: ['nearby-sightings', lat, lng],
  queryFn: () => getNearbyObservations(lat, lng, 25, 7),
});
```

## Map Customization

### Change Map Style

Edit `src/pages/MapPage.tsx`:

```typescript
// Current: Light theme
style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

// Dark theme
style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

// Voyager (colorful)
style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
```

### Change Marker Colors

```typescript
const RARITY_COLORS: Record<string, string> = {
  common: "#3a7d52",  // Green
  rare: "#d4913a",    // Orange
};
```

### Add Custom Marker Icons

```typescript
// Instead of emoji, use custom images
el.innerHTML = `<img src="/bird-icon.png" alt="bird" />`;
```

## Performance

- **Caching**: React Query caches results for 5 minutes
- **Markers**: Efficiently managed with refs
- **Updates**: Auto-refresh without page reload
- **Search**: Client-side filtering for instant results

## API Limits

eBird API has rate limits:
- **Free tier**: Reasonable limits for personal use
- **Rate limit**: Not publicly specified, but generous
- **Best practice**: Cache results, don't spam requests

## Troubleshooting

### No birds showing on map

1. Check API key in `.env`:
   ```bash
   VITE_EBIRD_API_KEY=679opnhtujv
   ```

2. Restart dev server:
   ```bash
   npm run dev
   ```

3. Check browser console for errors (F12)

4. Verify eBird API is accessible:
   ```bash
   curl -H "X-eBirdApiToken: 679opnhtujv" \
     "https://api.ebird.org/v2/data/obs/IN/recent"
   ```

### Map not loading

1. Check internet connection
2. Verify MapLibre GL is installed
3. Check browser console for errors

### Markers not clickable

1. Clear browser cache
2. Check z-index of overlays
3. Verify event listeners are attached

## Future Enhancements

### Easy Additions
- [ ] Filter by date range
- [ ] Filter by species type (raptors, waterfowl, etc.)
- [ ] Show bird photos from eBird
- [ ] Add clustering for dense areas
- [ ] Show heat map of sightings

### Medium Additions
- [ ] User can submit their own sightings
- [ ] Save favorite birds
- [ ] Get notifications for rare birds
- [ ] Show migration patterns
- [ ] Add bird call audio

### Advanced Features
- [ ] Real-time updates with WebSockets
- [ ] Machine learning for bird identification
- [ ] Social features (share sightings)
- [ ] Gamification (badges, achievements)
- [ ] Offline mode with cached data

## Resources

- [eBird API Documentation](https://documenter.getpostman.com/view/664302/S1ENwy59)
- [eBird Region Codes](https://ebird.org/region/world)
- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js-docs/api/)
- [React Query Docs](https://tanstack.com/query/latest)

## Example API Calls

### Get Recent Sightings in Delhi
```typescript
getRecentObservations('IN-DL', 7)
```

### Get Notable Birds in Maharashtra
```typescript
getNotableObservations('IN-MH', 14)
```

### Get Sightings Near Mumbai
```typescript
getNearbyObservations(19.0760, 72.8777, 50, 7)
```

### Get All Peacock Sightings in India
```typescript
getSpeciesObservations('IN', 'compea', 30)
```

## Tips

1. **Performance**: Limit to 7-14 days for faster loading
2. **UX**: Show loading state while fetching data
3. **Error Handling**: Gracefully handle API failures
4. **Caching**: Use React Query's built-in caching
5. **Mobile**: Test on mobile devices for touch interactions

## Support

- Check browser console for errors
- Verify API key is correct
- Test API directly with curl/Postman
- Check eBird API status page

Happy bird watching! 🐦✨
