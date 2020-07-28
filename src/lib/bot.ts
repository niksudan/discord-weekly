import {
  Client,
  Guild,
  TextChannel,
  SnowflakeUtil,
  Message,
  Collection,
  User,
} from 'discord.js';
import moment from 'moment';
import Fuse from 'fuse.js';

import Spotify from './spotify';
import YouTube from './youtube';
import AppleMusic from './apple';
import SoundCloud from './soundcloud';

require('dotenv').config();

type Messages = Collection<string, Message>;

type ServiceType = 'spotify' | 'youtube' | 'apple' | 'soundcloud';

interface TrackData {
  url: string;
  service: Service;
  author: User;
}

interface Service {
  type: ServiceType;
  match: (content: string) => RegExpMatchArray;
  get?: (url: string) => Promise<string>;
}

const services: Service[] = [
  {
    type: 'spotify',
    match: Spotify.match,
  },
  {
    type: 'youtube',
    match: YouTube.match,
    get: YouTube.get,
  },
  {
    type: 'apple',
    match: AppleMusic.match,
    get: AppleMusic.get,
  },
  {
    type: 'soundcloud',
    match: SoundCloud.match,
    get: SoundCloud.get,
  },
];

export default class Bot {
  public client: Client;
  public guild?: Guild;

  constructor() {
    this.client = new Client();
  }

  /**
   * Login to Discord and connect to guild
   */
  public async login() {
    console.log('Logging in...');
    await this.client.login(process.env.DISCORD_TOKEN);
    this.guild = this.client.guilds.cache.find(
      (guild) => guild.id == process.env.DISCORD_GUILD_ID!,
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
      `Fetching messages in ${
        channel.name
      } from ${fromDate.toString()} to ${toDate.toString()}...`,
    );
    const newMessages = await channel.messages.fetch({
      before: SnowflakeUtil.generate(toDate.toDate()),
    });

    // If the payload is empty, there are no more messages left in the channel
    if (newMessages.size === 0) {
      return messages;
    }

    // We're only interested in getting the messages before the target date
    const messagesToAdd = newMessages.filter((message) =>
      moment(message.createdAt).isBetween(fromDate, toDate),
    );

    // If all messages were after the target date, fetch for more
    return this.fetchMessages(
      channel,
      fromDate,
      moment(newMessages.last()?.createdAt).subtract(1, 'ms'),
      messages.concat(messagesToAdd),
    );
  }

  /**
   * Find a channel by ID
   */
  private async findChannel(id: string) {
    return (await this.client.channels.fetch(
      process.env.MUSIC_SOURCE_CHANNEL_ID,
    )) as TextChannel;
  }

  /**
   * Find messages with valid links
   */
  private parseTrackData(messages: Messages) {
    let trackData: TrackData[] = [];
    messages.forEach(({ content, author }) => {
      let match: RegExpMatchArray;
      for (let service of services) {
        match = service.match(content);
        if (match) {
          trackData = trackData.concat(
            match.map((url) => ({
              url,
              service,
              author,
            })),
          );
        }
        match = undefined;
      }
    });
    return trackData;
  }

  /**
   * Convert track data into Spotify URIs
   */
  public async convertTrackData(spotify: Spotify, trackData: TrackData[]) {
    const tracks: string[] = [];
    const contributions: { author: User; count: number }[] = [];
    const stats: Record<ServiceType, number> = {
      spotify: 0,
      youtube: 0,
      apple: 0,
      soundcloud: 0,
    };

    const addContribution = (author: User) => {
      const index = contributions.findIndex(
        (contribution) => contribution.author.id === author.id,
      );
      if (index === -1) {
        contributions.push({ author, count: 1 });
        return;
      }
      contributions[index].count += 1;
    };

    for (let { author, service, url } of trackData) {
      // Push the Spotify track directly
      if (service.type === 'spotify') {
        tracks.push(
          `spotify:track:${url.replace(
            /https:\/\/open.spotify.com\/track\//gi,
            '',
          )}`,
        );
        stats.spotify += 1;
        addContribution(author);
        continue;
      }

      // Attempt to parse title from service
      const title = await service.get(url);

      // Prepare a search query
      let searchQuery = title;
      if (service.type === 'youtube') {
        searchQuery = title
          .replace(/ *\([^)]*\) */g, '')
          .replace(/[^A-Za-z0-9 ]/g, '')
          .replace(/\s{2,}/g, ' ');
      }
      if (searchQuery.length < 3) {
        break;
      }

      // Create a search query
      const fuse = new Fuse(await spotify.searchTracks(searchQuery), {
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

      // Find the best song match
      const fuzzyResults = fuse.search(title);
      if (fuzzyResults.length) {
        tracks.push(fuzzyResults[0].item.uri);
        addContribution(author);
        stats[service.type] += 1;
      }
    }

    return { tracks, stats, contributions };
  }

  /**
   * Generate a Spotify playlist
   */
  public async generatePlaylist(
    spotify: Spotify,
    weeksAgo = 1,
    savePlaylist = true,
  ) {
    console.log(`Generating playlist from ${weeksAgo} week(s) ago...`);
    const channel = await this.findChannel(process.env.MUSIC_SOURCE_CHANNEL_ID);
    if (!channel) {
      return;
    }

    // Calculate the date range
    const fromDate = moment()
      .startOf('isoWeek')
      .startOf('day')
      .subtract(weeksAgo, 'week');
    const toDate = fromDate.clone().endOf('isoWeek');

    // Determine new playlist title
    const playlistName = `${process.env.PLAYLIST_NAME} (${fromDate.format(
      'Do MMMM',
    )} - ${toDate.format('Do MMMM')})`;

    // Reset playlist
    if (savePlaylist) {
      await spotify.clearPlaylist();
      await spotify.renamePlaylist(playlistName);
    }

    // Fetch all messages from the channel within the past week
    const messages = await (
      await this.fetchMessages(channel, fromDate, toDate)
    ).filter((message) => !message.author.bot);
    console.log(`${messages.size} message(s) fetched in total`);

    // Parse track URLs
    const trackData = this.parseTrackData(messages);

    // Convert URLs into Spotify URIs if possible
    const { tracks, stats, contributions } = await this.convertTrackData(
      spotify,
      trackData,
    );
    console.log(`${tracks.length} track(s) found`, stats);

    // Update the playlist with the tracks
    if (savePlaylist && tracks.length) {
      await spotify.addTracksToPlaylist(tracks.reverse());
    }

    console.log(
      'Playlist was updated successfully',
      `https://open.spotify.com/playlist/${process.env.PLAYLIST_ID}`,
    );

    // Send the news update
    const newsChannel = await this.findChannel(
      process.env.MUSIC_DESTINATION_CHANNEL_ID,
    );
    if (!newsChannel) {
      return;
    }

    let message = `**${playlistName} is now available for listening!**\n\n`;

    message += "This week's top curators:\n";
    contributions
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach((contribution) => {
        message += `- <@${contribution.author.id}> (${
          contribution.count
        } contribution${contribution.count === 1 ? '' : 's'})\n`;
      });

    message += `\nListen now!\nhttps://open.spotify.com/playlist/${process.env.PLAYLIST_ID}`;

    console.log(message);
    await newsChannel.send(message);
    console.log(`News update sent to ${newsChannel.name}!`);
  }
}
