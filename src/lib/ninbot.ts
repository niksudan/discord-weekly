import { Client, Guild } from "discord.js";

require("dotenv").config();

export default class Ninbot {
  public client: Client;
  public guild: Guild;

  constructor() {
    this.client = new Client();
    this.client.on("ready", () => {
      console.log("HEAD LIKE A HOLE\nI'M READY TO ROLL");
    });
  }

  /**
   * Initiate year zero
   */
  public async login() {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
      this.guild = this.client.guilds.find(
        guild => guild.id === process.env.DISCORD_GUILD_ID
      );
      console.log(`Logged in successfully to "${this.guild.name}"`);
    } catch (e) {
      console.log(e.message);
      process.exit(1);
    }
  }
}
