const { sql } = require('../config/database');

async function getAppSettings(req, res) {
  try {
    let row = null;
    try {
      const [data] = await sql`SELECT * FROM app_settings WHERE id = 1 LIMIT 1;`;
      row = data;
    } catch (e) {
      console.warn("SQL settings fetch warning:", e.message);
    }

    return res.status(200).json({
      latestVersion: row?.latest_version || "1.2.0",
      downloadUrl: row?.download_url || "https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/releases/tribo-latest.apk",
      forceUpdate: Boolean(row?.force_update),
      releaseNotes: row?.release_notes || "",
      globalFeedEnabled: Boolean(row?.global_feed_enabled || row?.is_global_feed_enabled),
      enableTriboFeed: Boolean(row?.enable_tribo_feed),
      enableTriboTrends: Boolean(row?.enable_tribo_trends),
      enable_tribo_feed: Boolean(row?.enable_tribo_feed),
      enable_tribo_trends: Boolean(row?.enable_tribo_trends),
      is_global_feed_enabled: Boolean(row?.global_feed_enabled || row?.is_global_feed_enabled),
      platform_status: row?.platform_status || "ACTIVE",
      platformStatus: row?.platform_status || "ACTIVE",
      suspension_reason: row?.suspension_reason || "",
      suspensionReason: row?.suspension_reason || "",
      suspended_at: row?.suspended_at || null,
      suspendedAt: row?.suspended_at || null
    });
  } catch (err) {
    console.error("App settings route error:", err);
    return res.status(200).json({
      latestVersion: "1.2.0",
      downloadUrl: "https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/releases/tribo-latest.apk",
      forceUpdate: false,
      releaseNotes: "",
      enable_tribo_feed: false,
      enable_tribo_trends: false,
      enableTriboFeed: false,
      enableTriboTrends: false,
      globalFeedEnabled: false,
      platform_status: "ACTIVE",
      platformStatus: "ACTIVE",
      suspension_reason: "",
      suspensionReason: "",
      suspended_at: null,
      suspendedAt: null
    });
  }
}

module.exports = {
  getAppVersion: getAppSettings,
  getAppSettings
};