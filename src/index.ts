import Ninbot from "./lib/ninbot";

(async () => {
  const ninbot = new Ninbot();
  await ninbot.login();
})();
