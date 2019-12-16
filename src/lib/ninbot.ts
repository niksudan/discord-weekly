import {
  Client,
  Guild,
  TextChannel,
  SnowflakeUtil,
  Message,
  Collection,
  User,
} from 'discord.js';
import * as moment from 'moment';
import * as Fuse from 'fuse.js';

import Spotify from './spotify';
import YouTube from './youtube';

require('dotenv').config();

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
    console.log('Logging in...');
    await this.client.login(process.env.DISCORD_TOKEN);
    this.guild = this.client.guilds.find(
      guild => guild.id === process.env.DISCORD_GUILD_ID,
    );
    console.log(
      `Logged in to Discord and connected to ${this.guild.name} (#${this.guild.id})`,
    );
  }

  /**
   * Fetch messages from a text channel up until a certain date
   */
  public async fetchMessages(
    channel: TextChannel,
    fromDate: moment.Moment,
    toDate: moment.Moment,
    messages: Messages = new Collection<string, Message>(),
  ): Promise<Messages> {
    if (fromDate.isAfter(toDate)) {
      return messages;
    }

    // Fetch 50 messages before the specified end date
    console.log(
      `Fetching messages from ${fromDate.toString()} to ${toDate.toString()}...`,
    );
    const newMessages = await channel.fetchMessages({
      before: SnowflakeUtil.generate(toDate.toDate()),
    });

    // If the payload is empty, there are no more messages left in the channel
    if (newMessages.size === 0) {
      return messages;
    }

    // We're only interested in getting the messages before the target date
    const messagesToAdd = newMessages.filter(message =>
      moment(message.createdAt).isBetween(fromDate, toDate),
    );

    // If all messages were after the target date, fetch for more
    return this.fetchMessages(
      channel,
      fromDate,
      moment(newMessages.last().createdAt).subtract(1, 'ms'),
      messages.concat(messagesToAdd),
    );
  }

  /**
   * Generate a Spotify playlist
   */
  public async generatePlaylist(spotify: Spotify, weeksAgo = 1) {
    console.log(`Generating playlist from ${weeksAgo} week(s) ago...`);
    const channel = this.guild.channels.find(
      channel => channel.name === 'non-nin-music' && channel.type === 'text',
    ) as TextChannel;
    if (!channel) {
      return;
    }

    // Calculate the date range
    const fromDate = moment()
      .startOf('isoWeek')
      .startOf('day')
      .subtract(weeksAgo, 'week');
    const toDate = fromDate.clone().endOf('isoWeek');

    // Reset playlist
    await spotify.clearPlaylist();
    await spotify.renamePlaylist(
      `${process.env.PLAYLIST_NAME} (${fromDate.format(
        'Do MMMM',
      )} - ${toDate.format('Do MMMM')})`,
    );

    // Fetch all messages from the channel within the past week
    const messages = await this.fetchMessages(channel, fromDate, toDate);
    console.log(
      `${messages.size} message(s) were fetched in total`,
      // messages.map(message => message.content),
    );

    let items: {
      url: string;
      service: 'spotify' | 'youtube';
      author: User;
    }[] = [];

    // Filter for messages to those that contain valid links
    messages.forEach(message => {
      const spotifyMatch = message.content.match(
        /https:\/\/open.spotify.com\/track\/(\w+)/gi,
      );
      if (spotifyMatch) {
        items = items.concat(
          spotifyMatch.map(url => ({
            url,
            service: 'spotify',
            author: message.author,
          })),
        );
      }

      const youtubeMatch = message.content.match(
        /http(s)?:\/\/((w){3}.)?youtu(be|.be)?(\.com)?\/([^\s]+)/gi,
      );
      if (youtubeMatch) {
        items = items.concat(
          youtubeMatch.map(url => ({
            url,
            service: 'youtube',
            author: message.author,
          })),
        );
      }
    });

    // Convert the submissions into Spotify URIs if possible
    const tracks: string[] = [];
    const authors: User[] = [];
    let spotifyTrackCount = 0;
    let youtubeTrackCount = 0;

    for (let item of items) {
      switch (item.service) {
        case 'spotify':
          spotifyTrackCount += 1;
          tracks.push(
            `spotify:track:${item.url.replace(
              /https:\/\/open.spotify.com\/track\//gi,
              '',
            )}`,
          );
          authors.push(item.author);
          break;

        case 'youtube':
          const video = await YouTube.getVideo(item.url);
          if (!video) {
            break;
          }

          const formattedTitle = video.title
            .replace(/ *\([^)]*\) */g, '')
            .replace(/[^A-Za-z0-9 ]/g, '')
            .replace(/\s{2,}/g, ' ');

          const fuse = new Fuse(await spotify.searchTracks(formattedTitle), {
            threshold: 0.8,
            keys: [
              {
                name: 'title',
                weight: 0.7,
              },
              {
                name: 'artists.name',
                weight: 0.5,
              },
              {
                name: 'album',
                weight: 0.1,
              },
            ],
          });

          const fuzzyResults = fuse.search(video.title);
          if (fuzzyResults.length) {
            youtubeTrackCount += 1;
            tracks.push(fuzzyResults[0].uri);
            authors.push(item.author);
          }
          break;
      }
    }

    console.log(
      `${tracks.length} track(s) found (Spotify: ${spotifyTrackCount}. YouTube: ${youtubeTrackCount}`,
      tracks,
    );

    // Update the playlist with the tracks
    if (tracks.length) {
      await spotify.addTracksToPlaylist(tracks.reverse());
    }

    console.log(
      'Playlist was updated successfully',
      `https://open.spotify.com/playlist/${process.env.PLAYLIST_ID}`,
    );
  }
}
