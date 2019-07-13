import {
  Client,
  Guild,
  TextChannel,
  SnowflakeUtil,
  Message,
  Collection
} from "discord.js";
import * as moment from "moment";
import Spotify from "./spotify";

require("dotenv").config();

type Messages = Collection<string, Message>;

export default class Ninbot {
  public client: Client;
  public guild: Guild;

  constructor() {
    this.client = new Client();
  }

  /**
   * Initiate year zero
   */
  public async login() {
    console.log("Logging in...");
    await this.client.login(process.env.DISCORD_TOKEN);
    this.guild = this.client.guilds.find(
      guild => guild.id === process.env.DISCORD_GUILD_ID
    );
    console.log(
      `Logged in to Discord and connected to ${this.guild.name} (#${
        this.guild.id
      })`
    );
  }

  /**
   * Fetch messages from a text channel up until a certain date
   */
  public async fetchMessages(
    channel: TextChannel,
    targetDate: moment.Moment,
    currentMessages: Messages = new Collection<string, Message>(),
    beforeDate?: moment.Moment
  ): Promise<Messages> {
    console.log("Fetching messages...");
    let options = {};
    if (beforeDate) {
      options = {
        before: SnowflakeUtil.generate(
          beforeDate.subtract(1, "second").toDate()
        )
      };
    }
    const newMessages = await channel.fetchMessages(options);

    // If the payload is empty, there are no more messages left in the channel
    if (newMessages.size === 0) {
      console.log("No more messages to fetch in channel");
      return currentMessages;
    }

    // We're only interested in getting the messages before the target date
    const messagesToAdd = newMessages.filter(message =>
      moment(message.createdAt).isSameOrAfter(targetDate)
    );
    const messages = currentMessages.concat(messagesToAdd);

    // If all messages were after the target date, fetch for more
    if (messagesToAdd.size === 50) {
      const lastMessageDate = moment(messagesToAdd.last().createdAt);
      return this.fetchMessages(channel, targetDate, messages, lastMessageDate);
    }

    console.log(`No more messages to fetch after ${targetDate.toString()}`);
    return messages;
  }

  /**
   * Generate a Spotify playlist
   */
  public async generatePlaylist(spotify: Spotify) {
    console.log("Generating playlist...");
    const channel = this.guild.channels.find(
      channel => channel.name === "non-nin-music" && channel.type === "text"
    ) as TextChannel;
    if (!channel) {
      return;
    }

    // Fetch all messages from the channel within the past week
    const targetDate = moment()
      .subtract(1, "week")
      .startOf("day");
    const messages = await this.fetchMessages(channel, targetDate);
    console.log(`${messages.size} message(s) in total were fetched`);
    if (messages.size === 0) {
      return;
    }

    // Filter the messages to those that contain Spotify links
    let spotifyUrls = [];
    messages.forEach(message => {
      const match = message.content.match(
        /(https:\/\/open.spotify.com\/track\/[^\s]+)/g
      );
      if (match && match.length > 0) {
        spotifyUrls = spotifyUrls.concat(match);
      }
    });

    console.log(
      `${spotifyUrls.length} Spotify track(s) were detected`,
      spotifyUrls
    );
  }
}
