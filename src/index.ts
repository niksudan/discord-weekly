import Ninbot from "./lib/ninbot";
import Server from "./lib/server";
import Spotify from "./lib/spotify";

(async () => {
  setTimeout(() => {
    console.log("Took too long, exiting");
    process.exit(1);
  }, 1000 * 30);

  try {
    const spotify = new Spotify();
    new Server(spotify);
    if (!spotify.isAuthenticated) {
      console.log("WARNING: Spotify features won't work until you log in");
    } else {
      await spotify.refreshTokens();
    }
    const ninbot = new Ninbot();
    await ninbot.login();
    await ninbot.generatePlaylist(spotify);
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
