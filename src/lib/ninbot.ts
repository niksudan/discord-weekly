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
    fromDate: moment.Moment,
    toDate: moment.Moment,
    messages: Messages = new Collection<string, Message>()
  ): Promise<Messages> {
    if (fromDate.isAfter(toDate)) {
      return messages;
    }

    // Fetch 50 messages before the specified end date
    console.log(
      `Fetching messages from ${fromDate.toString()} to ${toDate.toString()}...`
    );
    const newMessages = await channel.fetchMessages({
      before: SnowflakeUtil.generate(toDate.toDate())
    });

    // If the payload is empty, there are no more messages left in the channel
    if (newMessages.size === 0) {
      return messages;
    }

    // We're only interested in getting the messages before the target date
    const messagesToAdd = newMessages.filter(message =>
      moment(message.createdAt).isBetween(fromDate, toDate)
    );

    // If all messages were after the target date, fetch for more
    return this.fetchMessages(
      channel,
      fromDate,
      moment(newMessages.last().createdAt).subtract(1, "ms"),
      messages.concat(messagesToAdd)
    );
  }

  /**
   * Generate a Spotify playlist
   */
  public async generatePlaylist(spotify: Spotify, weeksAgo = 1) {
    console.log(`Generating playlist from ${weeksAgo} week(s) ago...`);
    const channel = this.guild.channels.find(
      channel => channel.name === "non-nin-music" && channel.type === "text"
    ) as TextChannel;
    if (!channel) {
      return;
    }

    // Calculate the date range
    const fromDate = moment()
      .startOf("isoWeek")
      .startOf("day")
      .subtract(weeksAgo, "week");
    const toDate = fromDate.clone().endOf("isoWeek");

    // Reset playlist
    await spotify.clearPlaylist();
    await spotify.renamePlaylist(
      `${process.env.PLAYLIST_NAME} (${fromDate.format(
        "Do MMMM"
      )} - ${toDate.format("Do MMMM")})`
    );

    // Fetch all messages from the channel within the past week
    const messages = await this.fetchMessages(channel, fromDate, toDate);
    console.log(
      `${messages.size} message(s) were fetched in total`,
      messages.map(message => message.content)
    );

    // Filter the messages to those that contain Spotify links
    let spotifyUrls: string[] = [];
    messages.forEach(message => {
      const match = message.content.match(
        /https:\/\/open.spotify.com\/track\/([^? ]+)/gi
      );
      if (match) {
        spotifyUrls = spotifyUrls.concat(
          match.map(
            url =>
              `spotify:track:${url.replace(
                /https:\/\/open.spotify.com\/track\//gi,
                ""
              )}`
          )
        );
      }
    });

    console.log(
      `${spotifyUrls.length} Spotify track(s) were detected`,
      spotifyUrls
    );

    // Update the playlist with the tracks
    if (spotifyUrls.length) {
      await spotify.addTracksToPlaylist(spotifyUrls.reverse());
    }

    console.log(
      "Playlist was updated successfully",
      `https://open.spotify.com/playlist/${process.env.PLAYLIST_ID}`
    );
  }
}
