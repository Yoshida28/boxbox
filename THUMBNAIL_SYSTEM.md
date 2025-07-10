# F1 Thumbnail System

## Overview

The F1 Thumbnail System has been completely refactored to fetch race highlight thumbnails directly from the official FORMULA 1 YouTube channel without using AI or Edge Functions. The system now operates entirely on the frontend with local caching in Supabase.

## Key Changes

### ✅ **Removed Dependencies:**
- ❌ Gemini AI (no longer needed)
- ❌ Supabase Edge Functions (moved to frontend)
- ❌ Complex AI-powered search queries

### ✅ **New Architecture:**
- ✅ Direct YouTube API calls from frontend
- ✅ Local caching in Supabase database
- ✅ FORMULA 1 channel-only results
- ✅ Simple, reliable search patterns

## Files Created/Modified

### New Files:
1. **`src/lib/thumbnailService.ts`** - Main service for fetching and caching thumbnails
2. **`src/lib/thumbnailUtils.ts`** - Utility functions for thumbnail management
3. **`src/pages/ThumbnailAdminPage.tsx`** - Admin interface for cache management
4. **`supabase/migrations/20250101000000_create_thumbnail_cache.sql`** - Database schema

### Modified Files:
1. **`src/lib/thumbnailManager.ts`** - Updated to use new service
2. **`src/components/RaceCard.tsx`** - Updated to use utility functions

## Database Schema

The system uses a `thumbnail_cache` table with the following structure:

```sql
CREATE TABLE public.thumbnail_cache (
  id uuid not null default gen_random_uuid (),
  race_name text not null,
  video_id text not null,
  thumbnail_url text not null,
  channel_title text null,
  video_title text null,
  year text null,
  cached_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint thumbnail_cache_pkey primary key (id),
  constraint thumbnail_cache_race_name_year_key unique (race_name, year)
);
```

## How It Works

### 1. **Cache Check**
- First checks if thumbnail is already cached in database
- Returns cached result immediately if found

### 2. **YouTube Search**
- Searches YouTube API with pattern: `"{RaceName} Formula 1 Highlights {Year}"`
- Filters results to only include videos from the official F1 channel (ID: `UCB_qr77-2MVdNm0jKKG-h6g`)
- Only accepts videos with "highlight" in the title

### 3. **Thumbnail Generation**
- Uses YouTube's thumbnail API: `https://img.youtube.com/vi/{videoId}/maxresdefault.jpg`
- Falls back to HQ quality if maxres is not available
- Validates thumbnail accessibility

### 4. **Caching**
- Stores successful results in Supabase database
- Includes video metadata for future reference
- Uses unique constraint on race_name + year

## Environment Variables

Add these to your `.env` file:

```bash
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## API Functions

### Core Functions:
- `getRaceHighlightThumbnail(raceName, year)` - Main function to get thumbnail
- `getCacheStats()` - Get cache statistics
- `clearThumbnailCache()` - Clear all cached thumbnails

### Utility Functions:
- `isValidYouTubeVideoId(videoId)` - Validate YouTube video ID
- `getYouTubeThumbnailUrls(videoId)` - Get all thumbnail qualities
- `validateThumbnailUrl(url)` - Check if thumbnail is accessible
- `getCircuitFallbackThumbnail(circuitName)` - Get fallback image

## Usage Examples

### Basic Usage:
```typescript
import { getRaceHighlightThumbnail } from '../lib/thumbnailService'

const result = await getRaceHighlightThumbnail('Monaco Grand Prix', '2024')
if (result.success) {
  console.log('Thumbnail URL:', result.thumbnailUrl)
  console.log('Video ID:', result.videoId)
}
```

### With Fallback:
```typescript
import { getOptimizedThumbnail } from '../lib/thumbnailService'

const thumbnailUrl = await getOptimizedThumbnail('Monaco Grand Prix', '2024')
// Always returns a valid URL (either real thumbnail or fallback)
```

## Admin Interface

Access the admin interface at `/thumbnail-admin` to:
- View cache statistics
- Clear the cache
- Test thumbnail fetching
- Monitor system performance

## Performance Benefits

1. **Faster Response Times** - Cached results return instantly
2. **Reduced API Calls** - Only fetches from YouTube when needed
3. **Reliable Results** - Only official F1 content
4. **No AI Dependencies** - Simpler, more predictable behavior
5. **Better Error Handling** - Comprehensive fallback system

## Error Handling

The system includes robust error handling:
- Network failures → Fallback to cached data
- YouTube API errors → Fallback to static images
- Invalid video IDs → Circuit-specific fallbacks
- Missing API keys → Graceful degradation

## Migration Notes

### From Old System:
1. The old Edge Function can be removed
2. Gemini API key is no longer needed
3. Existing cached data will be preserved
4. New system is backward compatible

### Database Migration:
Run the migration to create the thumbnail_cache table:
```bash
supabase db push
```

## Troubleshooting

### Common Issues:

1. **"YouTube API key not configured"**
   - Add `VITE_YOUTUBE_API_KEY` to your environment variables

2. **"No official highlights found"**
   - Check if the race name is correct
   - Verify the year has official F1 highlights
   - Try different race name variations

3. **"Cache storage error"**
   - Check Supabase connection
   - Verify database permissions
   - Ensure thumbnail_cache table exists

### Debug Mode:
Enable console logging by setting:
```typescript
localStorage.setItem('debug-thumbnails', 'true')
```

## Future Enhancements

Potential improvements:
- Batch thumbnail fetching
- Automatic cache cleanup
- Performance metrics
- User preference storage
- Offline support 