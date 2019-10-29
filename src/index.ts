import Ninbot from './lib/ninbot';
import Server from './lib/server';
import Spotify from './lib/spotify';
import * as Sentry from '@sentry/node';

require('dotenv').config();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

(async () => {
  setTimeout(() => {
    console.log('Took too long, exiting');
    process.exit(1);
  }, 1000 * 30);

  try {
    const spotify = new Spotify();
    new Server(spotify);

    if (!spotify.isAuthenticated) {
      console.log("WARNING: Spotify features won't work until you log in");
      return;
    }
    await spotify.refreshTokens();

    const ninbot = new Ninbot();
    await ninbot.login();
    await ninbot.generatePlaylist(spotify, 1);
    process.exit(0);
  } catch (e) {
    console.log(e);
    Sentry.captureException(e);
    process.exit(1);
  }
})();
