import Ninbot from "./lib/ninbot";

(async () => {
  try {
    const ninbot = new Ninbot();
    await ninbot.login();
    await ninbot.generatePlaylist();
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    process.exit(1);
  }
})();
