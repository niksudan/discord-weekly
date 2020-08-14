import Bot from './lib/bot';
import Server from './lib/server';
import Spotify from './lib/spotify';
import * as Sentry from '@sentry/node';

require('dotenv').config();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

(async () => {
  // Abort the playlist generation if we take longer than 2 minutes
  setTimeout(() => {
    console.log('⚠️  Took too long, exiting');
    process.exit(1);
  }, 1000 * 120);

  try {
    // Start a new Spotify authentication server
    const spotify = new Spotify();
    new Server(spotify);
    if (!spotify.isAuthenticated) {
      console.log("⚠️  WARNING: Spotify features won't work until you log in");
      return;
    }

    // Validate Spotify credentials
    await spotify.refreshTokens();

    // Boot up bot
    const bot = new Bot();
    await bot.login();

    // Generate a playlist
    await bot.generatePlaylist(spotify, 1);

    process.exit(0);
  } catch (e) {
    console.log(e);
    Sentry.captureException(e);
    process.exit(1);
  }
})();
