import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno type declarations
declare global {
  interface Window {
    Deno: {
      env: {
        get(key: string): string | undefined
      }
    }
  }
  const Deno: {
    env: {
      get(key: string): string | undefined
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface YouTubeSearchResponse {
  items: Array<{
    id: {
      videoId: string
    }
    snippet: {
      title: string
      description: string
      publishedAt: string
      channelTitle: string
      channelId?: string
    }
    channelId?: string
  }>
}

interface CachedThumbnail {
  race_name: string
  video_id: string
  thumbnail_url: string
  channel_title: string
  video_title: string
  cached_at: string
  year?: string
}

interface ApiResponse {
  success: boolean
  raceName: string
  thumbnailUrl?: string
  videoId?: string
  channelTitle?: string
  videoTitle?: string
  cached?: boolean
  error?: string
}

// Initialize Supabase client for caching
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Add Gemini API key directly (for demo; in production, use secrets)
const geminiApiKey = 'AIzaSyBpDROmeZc_tr9J0iFCfn-YISh5PPixHvM';

async function getGeminiSearchQuery(raceName: string, year: string) {
  const prompt = `Generate the best YouTube search query to find the official Formula 1 race highlights for the ${raceName} ${year}. Only return the search query string.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  if (!response.ok) throw new Error('Gemini API error');
  const data = await response.json();
  const query = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return query || `${raceName} Formula 1 Highlights ${year}`;
}

async function searchYouTubeHighlights(raceName: string, year: string): Promise<ApiResponse> {
  console.log('Starting YouTube search for:', raceName, year)
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')
  
  console.log('YouTube API key configured:', !!youtubeApiKey)
  
  if (!youtubeApiKey || youtubeApiKey === 'your_youtube_api_key_here') {
    console.log('YouTube API key not configured')
    return {
      success: false,
      raceName,
      error: 'YouTube API key not configured'
    }
  }

  try {
    // 1. Get the best search query from Gemini
    let searchQuery;
    try {
      console.log('Getting Gemini search query')
      searchQuery = await getGeminiSearchQuery(raceName, year);
      console.log('Gemini search query:', searchQuery)
    } catch (e) {
      console.log('Gemini failed, using fallback query')
      searchQuery = `${raceName} Formula 1 Highlights ${year}`;
    }
    // 2. Use Gemini's query to search YouTube
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(searchQuery)}&type=video&key=${youtubeApiKey}&order=relevance&publishedAfter=${year}-01-01T00:00:00Z&publishedBefore=${year}-12-31T23:59:59Z`;
    console.log('YouTube search URL:', searchUrl.replace(youtubeApiKey, '[API_KEY]'))
    const response = await fetch(searchUrl);
    console.log('YouTube API response status:', response.status)
    if (!response.ok) {
      const errorText = await response.text()
      console.log('YouTube API error response:', errorText)
      throw new Error(`YouTube API error: ${response.status} - ${errorText}`)
    }
    const data: YouTubeSearchResponse = await response.json();
    console.log('YouTube API response items count:', data.items?.length || 0)
    // 3. Only accept official F1 channel highlights
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        // channelId is at the top level for search results, but fallback to snippet.channelId if needed
        const channelId = item.channelId || (item.snippet && item.snippet.channelId) || '';
        const channelTitle = item.snippet.channelTitle.toLowerCase();
        const videoTitle = item.snippet.title.toLowerCase();
        if (
          channelId === 'UCB_qr77-2MVdNm0jKKG-h6g' ||
          channelTitle.includes('formula 1')
        ) {
          if (videoTitle.includes('highlight')) {
            const videoId = item.id.videoId;
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            // Verify thumbnail exists
            try {
              const thumbnailCheck = await fetch(thumbnailUrl, { method: 'HEAD' });
              const finalThumbnailUrl = thumbnailCheck.ok
                ? thumbnailUrl
                : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              return {
                success: true,
                raceName,
                thumbnailUrl: finalThumbnailUrl,
                videoId,
                channelTitle: item.snippet.channelTitle,
                videoTitle: item.snippet.title
              };
            } catch {
              return {
                success: true,
                raceName,
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                videoId,
                channelTitle: item.snippet.channelTitle,
                videoTitle: item.snippet.title
              };
            }
          }
        }
      }
    }
    // No official highlight found
    return {
      success: false,
      raceName,
      error: `No official highlights found for ${raceName} ${year}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      raceName,
      error: `YouTube/Gemini API error: ${errorMessage}`
    };
  }
}

async function getCachedThumbnail(raceName: string, year: string): Promise<CachedThumbnail | null> {
  try {
    const { data, error } = await supabase
      .from('thumbnail_cache')
      .select('*')
      .eq('race_name', raceName)
      .eq('year', year)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Cache lookup error:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Cache error:', error)
    return null
  }
}

async function cacheThumbnail(thumbnail: CachedThumbnail): Promise<void> {
  try {
    const { error } = await supabase
      .from('thumbnail_cache')
      .upsert(thumbnail, { 
        onConflict: 'race_name,year',
        ignoreDuplicates: false 
      })

    if (error) {
      console.error('Cache storage error:', error)
    } else {
      console.log(`Cached thumbnail for ${thumbnail.race_name} ${thumbnail.year}`)
    }
  } catch (error) {
    console.error('Cache storage error:', error)
  }
}

async function handleCacheClear(): Promise<Response> {
  try {
    const { error } = await supabase
      .from('thumbnail_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to clear cache',
        details: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function handleCacheStats(): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('thumbnail_cache')
      .select('year, cached_at')

    if (error) throw error

    const stats = {
      totalCached: data?.length || 0,
      byYear: {} as Record<string, number>,
      oldestCache: null as string | null,
      newestCache: null as string | null
    }

    if (data && data.length > 0) {
      // Group by year
      data.forEach((item: { year?: string; cached_at: string }) => {
        const year = item.year || 'unknown'
        stats.byYear[year] = (stats.byYear[year] || 0) + 1
      })

      // Find oldest and newest
      const dates = data.map((item: { cached_at: string }) => item.cached_at).sort()
      stats.oldestCache = dates[0]
      stats.newestCache = dates[dates.length - 1]
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get cache stats',
        details: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathname = url.pathname

    // Health check endpoint
    if (pathname.endsWith('/health')) {
      return handleHealthCheck()
    }

    // Main thumbnail endpoint
    if (pathname.endsWith('/race-thumbnails') && req.method === 'GET') {
      return await handleThumbnailRequest(url)
    }

    // Cache management endpoints
    if (pathname.endsWith('/cache/clear') && req.method === 'POST') {
      return await handleCacheClear()
    }

    if (pathname.endsWith('/cache/stats') && req.method === 'GET') {
      return await handleCacheStats()
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleHealthCheck(): Promise<Response> {
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')
  
  if (!youtubeApiKey || youtubeApiKey === 'your_youtube_api_key_here') {
    return new Response(
      JSON.stringify({
        success: false,
        status: 'unhealthy',
        error: 'YouTube API key not configured',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Test YouTube API connectivity
  try {
    const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=F1&type=video&key=${youtubeApiKey}`
    const response = await fetch(testUrl)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`YouTube API test failed: ${response.status} - ${errorText}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: 'healthy',
        services: {
          youtubeApi: 'connected',
          supabase: 'connected',
          cache: 'operational'
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        status: 'unhealthy',
        error: 'YouTube API connectivity test failed',
        details: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

async function handleThumbnailRequest(url: URL): Promise<Response> {
  console.log('Handling thumbnail request:', url.toString())
  
  const raceName = url.searchParams.get('raceName')
  const year = url.searchParams.get('year') || '2025'
  
  console.log('Parameters:', { raceName, year })
  
  if (!raceName) {
    console.log('Missing raceName parameter')
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'raceName parameter is required' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    // Check cache first
    console.log('Checking cache for:', raceName, year)
    const cachedResult = await getCachedThumbnail(raceName, year)
    if (cachedResult) {
      console.log('Found cached result for:', raceName, year)
      return new Response(
        JSON.stringify({
          success: true,
          raceName,
          thumbnailUrl: cachedResult.thumbnail_url,
          videoId: cachedResult.video_id,
          channelTitle: cachedResult.channel_title,
          videoTitle: cachedResult.video_title,
          cached: true,
          year
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch from YouTube API
    console.log('No cache found, fetching from YouTube API')
    const youtubeResult = await searchYouTubeHighlights(raceName, year)
    console.log('YouTube API result:', youtubeResult)
    
    if (!youtubeResult.success) {
      console.log('YouTube API failed:', youtubeResult.error)
      return new Response(
        JSON.stringify(youtubeResult),
        { 
          status: youtubeResult.error?.includes('No highlights') ? 404 : 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Cache the result
    console.log('Caching successful result')
    await cacheThumbnail({
      race_name: raceName,
      video_id: youtubeResult.videoId!,
      thumbnail_url: youtubeResult.thumbnailUrl!,
      channel_title: youtubeResult.channelTitle!,
      video_title: youtubeResult.videoTitle!,
      cached_at: new Date().toISOString(),
      year
    })

    return new Response(
      JSON.stringify({
        ...youtubeResult,
        cached: false,
        year
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in handleThumbnailRequest:', error)
    return new Response(
      JSON.stringify({
        success: false,
        raceName,
        error: `Internal server error: ${errorMessage}`
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}