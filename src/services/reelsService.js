const reelsModel = require('../models/reelsModel');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

const categoryVideosCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

const userSeenCache = new Map();
const MAX_SEEN_PER_USER = 500;

function getUserSeenSet(userId) {
  if (!userId) return new Set();
  if (!userSeenCache.has(userId)) {
    userSeenCache.set(userId, new Set());
  }
  return userSeenCache.get(userId);
}

function recordUserSeen(userId, videoIds = []) {
  if (!userId || videoIds.length === 0) return;
  const set = getUserSeenSet(userId);
  videoIds.forEach(id => set.add(id));
  if (set.size > MAX_SEEN_PER_USER) {
    const arr = Array.from(set);
    const trimmed = arr.slice(arr.length - MAX_SEEN_PER_USER);
    userSeenCache.set(userId, new Set(trimmed));
  }
}

async function searchYouTubeHtml(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' #shorts')}&sp=CAISAhAB`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(8000)
    });
    const html = await res.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (!match) return [];
    const json = JSON.parse(match[1]);
    const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const videos = [];
    for (const section of contents) {
      const items = section.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item.videoRenderer || item.compactVideoRenderer || item.reelItemRenderer;
        if (v && v.videoId) {
          const videoId = v.videoId;
          const title = v.title?.runs?.[0]?.text || v.headline?.simpleText || 'Reel em Alta';
          const channel = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || 'YouTube';
          const thumbs = v.thumbnail?.thumbnails || [];
          const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          videos.push({
            id: videoId,
            videoId,
            title: title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
            channel,
            channelTitle: channel,
            thumbnailUrl: thumbnail,
            videoUrl: `https://www.youtube.com/shorts/${videoId}`,
            embedUrl: `https://www.youtube.com/embed/${videoId}`
          });
        }
      }
    }
    return videos;
  } catch (err) {
    console.warn('[ReelsService] HTML search fallback warning:', err.message);
    return [];
  }
}

async function fetchShortsForCategory(categoryObj, forceRefresh = false) {
  const cacheKey = categoryObj.id;
  const now = Date.now();

  const cached = categoryVideosCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > now && cached.items && cached.items.length >= 10) {
    return cached.items;
  }

  const queries = categoryObj.queries || [categoryObj.query || 'memes brasil 2026 shorts'];
  const allFetched = [];
  const seenIdsInFetch = new Set();

  const queriesToRun = queries.slice(0, 3);

  for (const q of queriesToRun) {
    try {
      const fullQuery = `${q} #shorts`;
      const publishedAfter = '2025-11-01T00:00:00Z';
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&q=${encodeURIComponent(fullQuery)}&publishedAfter=${publishedAfter}&regionCode=BR&maxResults=25&key=${YOUTUBE_API_KEY}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.items && data.items.length > 0) {
        data.items.forEach(item => {
          if (!item.id || !item.id.videoId || seenIdsInFetch.has(item.id.videoId)) return;
          seenIdsInFetch.add(item.id.videoId);

          const videoId = item.id.videoId;
          const snippet = item.snippet || {};
          const thumbs = snippet.thumbnails || {};
          const thumbnail = thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url;

          const cleanTitle = (snippet.title || '')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

          allFetched.push({
            id: videoId,
            videoId,
            title: cleanTitle,
            channel: snippet.channelTitle || 'YouTube',
            channelTitle: snippet.channelTitle || 'YouTube',
            channelId: snippet.channelId || null,
            category: categoryObj.id,
            categoryLabel: categoryObj.label,
            categoryEmoji: categoryObj.emoji,
            thumbnailUrl: thumbnail,
            videoUrl: `https://www.youtube.com/shorts/${videoId}`,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            publishedAt: snippet.publishedAt
          });
        });
      } else {
        // Se a API do YouTube der 429 ou erro de quota, usa o buscador HTML direto
        const htmlResults = await searchYouTubeHtml(q);
        htmlResults.forEach(v => {
          if (!seenIdsInFetch.has(v.videoId)) {
            seenIdsInFetch.add(v.videoId);
            allFetched.push({
              ...v,
              category: categoryObj.id,
              categoryLabel: categoryObj.label,
              categoryEmoji: categoryObj.emoji
            });
          }
        });
      }
    } catch (err) {
      console.warn(`[ReelsService] Search fallback for ${categoryObj.id}: ${q}`, err.message);
      try {
        const htmlResults = await searchYouTubeHtml(q);
        htmlResults.forEach(v => {
          if (!seenIdsInFetch.has(v.videoId)) {
            seenIdsInFetch.add(v.videoId);
            allFetched.push({
              ...v,
              category: categoryObj.id,
              categoryLabel: categoryObj.label,
              categoryEmoji: categoryObj.emoji
            });
          }
        });
      } catch (e) {}
    }
  }

  if (allFetched.length > 0) {
    categoryVideosCache.set(cacheKey, {
      items: allFetched,
      expiresAt: now + CACHE_TTL_MS
    });
    return allFetched;
  }

  if (cached && cached.items && cached.items.length > 0) {
    return cached.items;
  }

  return [];
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchShortsForCustomPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return [];
  const cacheKey = 'custom_' + prompt.trim().toLowerCase();
  const now = Date.now();

  const cached = categoryVideosCache.get(cacheKey);
  if (cached && cached.expiresAt > now && cached.items && cached.items.length > 0) {
    return cached.items;
  }

  const terms = prompt.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
  const searchQueries = terms.length > 0 ? terms.slice(0, 3) : [prompt.trim()];
  const allFetched = [];
  const seen = new Set();

  for (const queryTerm of searchQueries) {
    try {
      const fullQuery = `${queryTerm} 2026 #shorts`;
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&q=${encodeURIComponent(fullQuery)}&regionCode=BR&maxResults=20&key=${YOUTUBE_API_KEY}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.items) {
        data.items.forEach(item => {
          if (!item.id || !item.id.videoId || seen.has(item.id.videoId)) return;
          seen.add(item.id.videoId);

          const videoId = item.id.videoId;
          const snippet = item.snippet || {};
          const thumbs = snippet.thumbnails || {};
          const thumbnail = thumbs.maxres?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url;

          const cleanTitle = (snippet.title || '')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

          allFetched.push({
            id: videoId,
            videoId,
            title: cleanTitle,
            channel: snippet.channelTitle || 'YouTube',
            channelTitle: snippet.channelTitle || 'YouTube',
            channelId: snippet.channelId || null,
            category: 'personalizado',
            categoryLabel: queryTerm,
            categoryEmoji: '✨',
            thumbnailUrl: thumbnail,
            videoUrl: `https://www.youtube.com/shorts/${videoId}`,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            publishedAt: snippet.publishedAt
          });
        });
      } else {
        const htmlResults = await searchYouTubeHtml(queryTerm);
        htmlResults.forEach(v => {
          if (!seen.has(v.videoId)) {
            seen.add(v.videoId);
            allFetched.push({
              ...v,
              category: 'personalizado',
              categoryLabel: queryTerm,
              categoryEmoji: '✨'
            });
          }
        });
      }
    } catch (err) {
      console.warn('[ReelsService] Custom prompt search fallback:', err.message);
      try {
        const htmlResults = await searchYouTubeHtml(queryTerm);
        htmlResults.forEach(v => {
          if (!seen.has(v.videoId)) {
            seen.add(v.videoId);
            allFetched.push({
              ...v,
              category: 'personalizado',
              categoryLabel: queryTerm,
              categoryEmoji: '✨'
            });
          }
        });
      } catch (e) {}
    }
  }

  if (allFetched.length > 0) {
    categoryVideosCache.set(cacheKey, {
      items: allFetched,
      expiresAt: now + CACHE_TTL_MS
    });
  }

  return allFetched;
}

async function getPersonalizedReelsFeed(userId, limit = 20, excludeIds = [], resetSeen = false) {
  if (resetSeen && userId) {
    userSeenCache.delete(userId);
  }

  const categories = reelsModel.getAvailableCategories();
  const preferences = (await reelsModel.getUserPreferences(userId)) || {};

  const selectedCategories = preferences.selectedCategories || [];
  const scores = preferences.categoryScores || {};

  const activeCategories = selectedCategories.length > 0
    ? categories.filter(c => selectedCategories.includes(c.id))
    : categories;

  const videoPromises = activeCategories.map(cat => fetchShortsForCategory(cat));
  let customPromptResults = [];
  if (preferences.customPrompt) {
    videoPromises.push(fetchShortsForCustomPrompt(preferences.customPrompt).then(res => { customPromptResults = res; return res; }));
  }
  const categoryResults = await Promise.all(videoPromises);

  const poolByCategory = new Map();
  activeCategories.forEach((cat, index) => {
    const shuffled = shuffleArray(categoryResults[index] || []);
    poolByCategory.set(cat.id, shuffled);
  });

  const blockedVideoIds = await reelsModel.getUserBlockedVideoIds(userId);
  const userSeenSet = getUserSeenSet(userId);

  const globalSeenSet = new Set([...blockedVideoIds, ...userSeenSet, ...excludeIds]);

  const weights = [];
  activeCategories.forEach(cat => {
    const rawScore = scores[cat.id] !== undefined ? scores[cat.id] : 10;
    const weight = Math.max(1, rawScore);
    weights.push({ categoryId: cat.id, weight });
  });

  const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0);

  const feed = [];
  const selectedInThisBatch = new Set();

  let attempts = 0;
  const maxAttempts = limit * 6;

  while (feed.length < limit && attempts < maxAttempts) {
    attempts++;

    let random = Math.random() * totalWeight;
    let chosenCategoryId = weights[0].categoryId;

    for (const w of weights) {
      if (random < w.weight) {
        chosenCategoryId = w.categoryId;
        break;
      }
      random -= w.weight;
    }

    const pool = poolByCategory.get(chosenCategoryId);
    if (pool && pool.length > 0) {
      const candidateIndex = pool.findIndex(c => !globalSeenSet.has(c.videoId) && !selectedInThisBatch.has(c.videoId));

      if (candidateIndex !== -1) {
        const [candidate] = pool.splice(candidateIndex, 1);
        selectedInThisBatch.add(candidate.videoId);
        feed.push(candidate);
      }
    }
  }

  if (feed.length < limit) {
    for (const items of categoryResults) {
      for (const item of items) {
        if (feed.length >= limit) break;
        if (!selectedInThisBatch.has(item.videoId) && !blockedVideoIds.has(item.videoId)) {
          selectedInThisBatch.add(item.videoId);
          feed.push(item);
        }
      }
    }
  }

  let finalFeed = [];
  if (customPromptResults.length > 0) {
    const unseenCustom = customPromptResults.filter(c => !globalSeenSet.has(c.videoId));
    finalFeed = shuffleArray([...unseenCustom.slice(0, Math.ceil(limit * 0.6)), ...feed]).slice(0, limit);
  } else {
    finalFeed = shuffleArray(feed);
  }

  if (userId && finalFeed.length > 0) {
    recordUserSeen(userId, finalFeed.map(f => f.videoId));
  }

  const videoIds = finalFeed.map(v => v.videoId);
  const [userLikesSet, likesCountMap] = await Promise.all([
    reelsModel.getUserLikedVideoIds(userId, videoIds),
    reelsModel.getReelLikesCountMap(videoIds)
  ]);

  const enrichedFeed = finalFeed.map(v => ({
    ...v,
    isLiked: userLikesSet.has(v.videoId),
    likesCount: likesCountMap[v.videoId] || 0
  }));

  return {
    onboardingCompleted: preferences.onboardingCompleted,
    algorithmStatus: {
      activeCategories: activeCategories.map(c => c.id),
      topInterests: Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, score]) => ({ id, score }))
    },
    count: enrichedFeed.length,
    reels: enrichedFeed
  };
}

module.exports = {
  fetchShortsForCategory,
  getPersonalizedReelsFeed
};
