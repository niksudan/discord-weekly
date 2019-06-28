import {
  Client,
  Guild,
  TextChannel,
  SnowflakeUtil,
  Message,
  Collection
} from "discord.js";
import * as moment from "moment";

require("dotenv").config();

type Messages = Collection<string, Message>;

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
    await this.client.login(process.env.DISCORD_TOKEN);
    this.guild = this.client.guilds.find(
      guild => guild.id === process.env.DISCORD_GUILD_ID
    );
    console.log(`Logged in successfully to "${this.guild.name}"`);
  }

  /**
   * Fetch messages from a text channel up until a certain date
   */
  public async fetchMessages(
    channel: TextChannel,
    targetDate: moment.Moment,
    currentMessages: Messages = new Collection<string, Message>(),
    beforeDate?: Date
  ): Promise<Messages> {
    let options = {};

    // Fetch dates for the specified period
    if (beforeDate) {
      options = { before: SnowflakeUtil.generate(beforeDate) };
    }
    const newMessages = await channel.fetchMessages(options);

    // If there are no new messages, return what we have
    if (newMessages.size === 0) {
      return currentMessages;
    }

    // If we fetched the same messages as last time, return what we have
    if (
      currentMessages.size > 0 &&
      newMessages.last().id === currentMessages.last().id
    ) {
      return currentMessages;
    }

    // If we've passed the target date, return the new messages
    const messages = currentMessages.concat(newMessages);
    const lastMessageDate = moment(newMessages.last().createdAt);
    if (lastMessageDate.isBefore(targetDate)) {
      console.log("No more new messages before the target date");
      return messages;
    }

    // Fetch more dates if necessary
    return this.fetchMessages(
      channel,
      targetDate,
      messages,
      lastMessageDate.toDate()
    );
  }

  /**
   * Generate a playlist
   */
  public async generatePlaylist(channelName = "i-made-this") {
    const channel = this.guild.channels.find(
      channel => channel.name === channelName && channel.type === "text"
    ) as TextChannel;
    if (!channel) {
      return;
    }

    // Fetch all messages from the channel within the past week
    const targetDate = moment()
      .subtract(1, "week")
      .startOf("day");
    const messages = await this.fetchMessages(channel, targetDate);
    console.log(`${messages.size} message(s) found in channel`);

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

    console.log(`${spotifyUrls.length} Spotify tracks were detected`);
    console.log(spotifyUrls);
  }
}
