const Parser = require('rss-parser');
const ogs = require('open-graph-scraper');

const parser = new Parser();
const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419';
const FALLBACK_IMAGE = 'https://pub-34192334d7d14328ace69168b62cc510.r2.dev/fallback-news.jpg';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyCKRLRkfk0zazSFiWIwWdj9CNYVz-VSIus';

let trendsCache = null;
let cacheExpiration = null;
const CACHE_DURATION_MS = 20 * 60 * 1000;

let ytCache = null;
let ytCacheExpiration = null;
const YT_CACHE_DURATION_MS = 30 * 60 * 1000;

async function getTrends(req, res, next) {
  try {
    const now = Date.now();
    if (trendsCache && cacheExpiration && now < cacheExpiration) {
      return res.status(200).json({
        success: true,
        topic: "Trend Topics da Tribo",
        trends: trendsCache
      });
    }

    const feed = await parser.parseURL(GOOGLE_NEWS_RSS_URL);

    const items = feed.items.slice(0, 10);

    const trends = await Promise.all(items.map(async (item) => {
      let title = item.title || "";
      let source = "Google News";

      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        source = parts.pop();
        title = parts.join(' - ').trim();
      }

      let image = FALLBACK_IMAGE;

      try {
        if (item.link) {

          const ogsOptions = { url: item.link, timeout: 2000 };
          const { error, result } = await ogs(ogsOptions);
          if (!error && result.ogImage && result.ogImage.length > 0) {
            image = result.ogImage[0].url || FALLBACK_IMAGE;
          }
        }
      } catch (err) {

      }

      return {
        id: item.link || item.guid,
        title,
        source,
        image,
        link: item.link,
        pubDate: item.isoDate || item.pubDate
      };
    }));

    trendsCache = trends;
    cacheExpiration = Date.now() + CACHE_DURATION_MS;

    return res.status(200).json({
      success: true,
      topic: "Trend Topics da Tribo",
      trends
    });
  } catch (error) {
    next(error);
  }
}

async function getYoutubeNews(req, res, next) {
  try {
    const now = Date.now();
    if (ytCache && ytCacheExpiration && now < ytCacheExpiration) {
      return res.status(200).json({ success: true, news: ytCache });
    }

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=noticias&regionCode=BR&maxResults=10&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ ERRO YOUTUBE API:", data.error || data);
      return res.status(200).json({ success: true, news: ytCache || [] });
    }

    if (data.items) {
      console.log("✅ VÍDEOS ENCONTRADOS:", data.items.length);
      const news = data.items.map((item) => {
        const imageUrl = item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : item.snippet.thumbnails.default.url;
        return {
          id: item.id.videoId,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          source: item.snippet.channelTitle,
          channel: item.snippet.channelTitle,
          image: imageUrl,
          thumbnail: imageUrl,
          link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          pubDate: item.snippet.publishedAt
        };
      });

      ytCache = news;
      ytCacheExpiration = Date.now() + YT_CACHE_DURATION_MS;
      return res.status(200).json({ success: true, news });
    }

    return res.status(200).json({ success: true, news: ytCache || [] });
  } catch (error) {
    console.error("❌ ERRO YOUTUBE API:", error.message || error);
    return res.status(200).json({ success: true, news: ytCache || [] });
  }
}

module.exports = {
  getTrends,
  getYoutubeNews
};