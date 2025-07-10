# Race Thumbnails Edge Function

A Supabase Edge Function that automatically fetches and caches Formula 1 race highlight thumbnails from YouTube using AI-powered search queries.

## Features

- 🤖 **AI-Powered Search**: Uses Google Gemini to generate optimal YouTube search queries
- 🎯 **Official F1 Content**: Only returns videos from the official Formula 1 YouTube channel
- 💾 **Smart Caching**: Caches results in Supabase to reduce API calls and improve performance
- 🔍 **Multiple Endpoints**: Health checks, cache management, and thumbnail retrieval
- 🛡️ **Error Handling**: Robust error handling with fallback strategies

## API Endpoints

### 1. Get Race Thumbnail
```
GET /functions/v1/race-thumbnails?raceName={raceName}&year={year}
```

**Parameters:**
- `raceName` (required): Name of the F1 race (e.g., "Monaco", "Silverstone")
- `year` (optional): Year of the race (defaults to "2025")

**Response:**
```json
{
  "success": true,
  "raceName": "Monaco",
  "thumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg",
  "videoId": "VIDEO_ID",
  "channelTitle": "FORMULA 1",
  "videoTitle": "2024 Monaco Grand Prix Highlights",
  "cached": false,
  "year": "2024"
}
```

### 2. Health Check
```
GET /functions/v1/race-thumbnails/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "youtubeApi": "connected",
    "supabase": "connected",
    "cache": "operational"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Cache Management

#### Clear Cache
```
POST /functions/v1/race-thumbnails/cache/clear
```

#### Get Cache Stats
```
GET /functions/v1/race-thumbnails/cache/stats
```

## Environment Variables

Set these in your Supabase project:

```bash
YOUTUBE_API_KEY=your_youtube_api_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Schema

The function uses a `thumbnail_cache` table with the following structure:

```sql
CREATE TABLE thumbnail_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_name TEXT NOT NULL,
  year TEXT NOT NULL,
  video_id TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  video_title TEXT NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(race_name, year)
);
```

## How It Works

1. **Cache Check**: First checks if the thumbnail is already cached
2. **AI Search**: Uses Gemini to generate an optimal YouTube search query
3. **YouTube Search**: Searches YouTube with the AI-generated query
4. **Filter Results**: Only accepts videos from the official F1 channel with "highlight" in the title
5. **Thumbnail Verification**: Verifies the thumbnail URL exists, falls back to HQ if needed
6. **Cache Storage**: Stores the result for future requests

## Development

### Local Development
```bash
# Install Deno if not already installed
curl -fsSL https://deno.land/install.sh | sh

# Run locally
cd supabase/functions/race-thumbnails
deno run --allow-net --allow-env --watch index.ts
```

### Deploy
```bash
supabase functions deploy race-thumbnails
```

## Error Handling

The function handles various error scenarios:
- Missing API keys
- YouTube API failures
- No highlights found
- Network timeouts
- Invalid responses

All errors return structured JSON responses with appropriate HTTP status codes.

## Security Notes

- The Gemini API key is currently hardcoded for demo purposes
- In production, move it to environment variables
- The function uses CORS headers for cross-origin requests
- Service role key is used for database operations

## Performance

- Cached responses are served instantly
- YouTube API calls are minimized through intelligent caching
- Thumbnail verification uses HEAD requests for efficiency
- Results are cached indefinitely (clear manually if needed) 