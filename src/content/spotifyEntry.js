import { startSpotifyLyrics } from "./spotifyLyrics";
const api = globalThis.browser ?? chrome;

let stopSpotifyLyrics = null;

async function initSpotifyLyrics() {
  if (location.hostname !== "open.spotify.com") return;
  // The content bundle runs on many websites, but Spotify lyric logic should
  // only initialize on Spotify pages.
  let settings = { simplify: true, pinyin: true };
  try {
    const res = await api.runtime.sendMessage({ type: "getSettings" });
    const stored = res?.settings || {};
    // spotifyLyricsEnabled is retained for compatibility with older saved
    // settings. The two newer settings control the features independently.
    const legacyEnabled = stored.spotifyLyricsEnabled !== false;
    settings = {
      simplify: legacyEnabled && stored.spotifySimplifyEnabled !== false,
      pinyin: legacyEnabled && stored.spotifyPinyinEnabled !== false
    };
  } catch (err) {
    // Use the enabled default if settings are temporarily unavailable.
  }
  stopSpotifyLyrics = startSpotifyLyrics(settings);
  api.runtime.onMessage.addListener(msg => {
    if (msg?.type !== "setSpotifyLyricsSettings") return;
    // Stop first so existing modified lines are restored, then process them
    // again using the newly selected settings.
    stopSpotifyLyrics?.();
    stopSpotifyLyrics = startSpotifyLyrics({ simplify: msg.simplify, pinyin: msg.pinyin });
  });
}

initSpotifyLyrics();

