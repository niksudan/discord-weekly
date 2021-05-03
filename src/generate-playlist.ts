import Bot from './lib/bot';
import Server from './lib/server';
import Spotify from './lib/spotify';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

require('dotenv').config();

let transaction = undefined;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });

  transaction = Sentry.startTransaction({
    op: 'generate-playlist',
    name: `${process.env.PLAYLIST_NAME} (${new Date().toString()})`,
  });

  Sentry.configureScope((scope) => {
    scope.setSpan(transaction);
  });
}

(async () => {
  // Abort the playlist generation if we take longer than 10 minutes
  setTimeout(() => {
    console.log('⚠️  Took too long, exiting');
    process.exit(1);
  }, 1000 * 60 * 10);

  try {
    const startTime = new Date();

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

    // Benchmarks
    const endTime = new Date();
    const timeTaken = endTime.valueOf() - startTime.valueOf();
    console.log(`Took ${(timeTaken / 1000 / 60).toFixed(2)} minutes`);
    transaction?.finish();

    process.exit(0);
  } catch (e) {
    console.log(e);
    Sentry.captureException(e);
    process.exit(1);
  }
})();
