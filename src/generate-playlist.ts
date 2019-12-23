import Ninbot from './lib/ninbot';
import Server from './lib/server';
import Spotify from './lib/spotify';
import * as Sentry from '@sentry/node';

import './config';

(async () => {
  // Abort the playlist generation if we take longer than 30 seconds
  setTimeout(() => {
    console.log('Took too long, exiting');
    process.exit(1);
  }, 1000 * 30);

  try {
    // Start a new Spotify authentication server
    const spotify = new Spotify();
    new Server(spotify);
    if (!spotify.isAuthenticated) {
      console.log("WARNING: Spotify features won't work until you log in");
      return;
    }

    // Validate Spotify credentials
    await spotify.refreshTokens();

    // Boot up ninbot
    const ninbot = new Ninbot();
    await ninbot.login();

    // Generate a playlist
    await ninbot.generatePlaylist(spotify, 1, false);

    process.exit(0);
  } catch (e) {
    console.log(e);
    Sentry.captureException(e);
    process.exit(1);
  }
})();
