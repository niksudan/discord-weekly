import Ninbot from "./lib/ninbot";
import Server from "./lib/server";
import Spotify from "./lib/spotify";

(async () => {
  try {
    const spotify = new Spotify();
    new Server(spotify);
    if (!spotify.isAuthenticated) {
      console.log("WARNING: Spotify features won't work until you log in");
    } else {
      await spotify.refreshTokens();
      console.log("Logged in to Spotify as", await spotify.accountName);
    }
    const ninbot = new Ninbot();
    await ninbot.login();
    await ninbot.generatePlaylist(spotify);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    process.exit(1);
  }
})();
