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
import { uniq, chunk, flatten, capitalize, orderBy } from 'lodash';

import Spotify, { SpotifyTrack } from './spotify';
import YouTube from './youtube';
import AppleMusic from './apple';
import SoundCloud from './soundcloud';
import { sleep } from './sleep';

require('dotenv').config();

const LIKE_THRESHOLD = 2;
const DISLIKE_THRESHOLD = -1;
const ARTISTS_THRESHOLD = 2;
const NUMBER_OF_ITEMS = 5;

type Messages = Collection<string, Message>;

type ServiceType = 'spotify' | 'youtube' | 'apple' | 'soundcloud';

interface TrackData {
  url: string;
  service: Service;
  author: User;
  likes: number;
  timestamp: number;
}

interface Service {
  type: ServiceType;
  match: (content: string) => RegExpMatchArray;
  get?: (url: string) => Promise<string>;
}

interface ArtistData {
  id: string;
  name: string;
  count: number;
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
    await this.client.login(process.env.DISCORD_TOKEN);
    this.guild = this.client.guilds.cache.find(
      (guild) => guild.id == process.env.DISCORD_GUILD_ID!,
    );
    console.log(`✅  Connected to Discord`);
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
      `🌐  Fetching messages in ${
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
    return (await this.client.channels.fetch(id)) as TextChannel;
  }

  /**
   * Find messages with valid links
   */
  private async parseTrackData(messages: Messages) {
    let trackData: TrackData[] = [];

    for (let {
      content,
      author,
      reactions,
      createdTimestamp,
    } of messages.values()) {
      let match: RegExpMatchArray;
      for (let service of services) {
        match = service.match(content);
        if (match) {
          let likes = 0;
          let dislikes = 0;

          // Determine number of accurate likes/dislikes (do not count bots/authors)
          console.log(
            `👍  Fetching votes... (${
              (trackData.length / messages.size) * 100
            }%)`,
          );
          const likeData = reactions.cache.get('👍');
          if (likeData) {
            likes = (await likeData.users.fetch()).filter(
              (user) => user.id !== author.id && !user.bot,
            ).size;
          }
          const dislikeData = reactions.cache.get('👎');
          if (dislikeData) {
            dislikes = (await dislikeData.users.fetch()).filter(
              (user) => user.id !== author.id && !user.bot,
            ).size;
          }

          // Ignore pretty disliked tracks
          if (likes - dislikes > DISLIKE_THRESHOLD) {
            trackData = trackData.concat(
              match.map((url) => ({
                url,
                service,
                author,
                likes: likes - dislikes,
                timestamp: createdTimestamp,
              })),
            );
          }
        }
        match = undefined;
      }
    }
    return trackData;
  }

  /**
   * Convert track data into Spotify URIs
   */
  public async convertTrackData(spotify: Spotify, trackData: TrackData[]) {
    const tracks: {
      track: SpotifyTrack;
      likes: number;
      timestamp: number;
    }[] = [];
    const contributions: { author: User; count: number; likes: number }[] = [];
    const artists: ArtistData[] = [];
    const counts: Record<ServiceType, number> = {
      spotify: 0,
      youtube: 0,
      apple: 0,
      soundcloud: 0,
    };

    const logStats = (
      track: SpotifyTrack,
      author: User,
      service: Service,
      likes: number,
    ) => {
      // General stats
      counts[service.type] += 1;

      // Log artist stats
      track.artists.forEach((artist) => {
        const artistIndex = artists.findIndex(({ id }) => id === artist.id);
        if (artistIndex === -1) {
          artists.push({ id: artist.id, name: artist.name, count: 1 });
        } else {
          artists[artistIndex].count += 1;
        }
      });

      // Contributor stats
      const contributorIndex = contributions.findIndex(
        (contribution) => contribution.author.id === author.id,
      );
      if (contributorIndex === -1) {
        contributions.push({ author, count: 1, likes });
      } else {
        contributions[contributorIndex].count += 1;
        contributions[contributorIndex].likes += likes;
      }
    };

    // Bulk-fetch direct Spotify tracks
    for (let trackChunk of chunk(
      trackData.filter(({ service }) => service.type === 'spotify'),
      50,
    )) {
      console.log(
        `🔍  Fetching Spotify data... (${
          (tracks.length / trackData.length) * 100
        }%)`,
      );
      const spotifyTracks = await spotify.getTracks(
        trackChunk.map(({ url }) =>
          url.replace(/https:\/\/open.spotify.com\/track\//gi, ''),
        ),
      );
      for (let index in spotifyTracks) {
        const track = spotifyTracks[index];
        if (track) {
          const { author, likes, service, timestamp } = trackChunk[index];
          logStats(track, author, service, likes);
          tracks.push({
            track,
            likes,
            timestamp,
          });
        }
      }
      await sleep(1000);
    }

    // Search Spotify for the rest
    for (let { author, service, url, likes, timestamp } of trackData.filter(
      ({ service }) => service.type !== 'spotify',
    )) {
      const title = await service.get(url);

      if (!title) {
        continue;
      }

      let searchQuery = title;
      if (service.type === 'youtube') {
        searchQuery = title
          .replace(/ *\([^)]*\) */g, '')
          .replace(/[^A-Za-z0-9 ]/g, '')
          .replace(/\s{2,}/g, ' ');
      }

      if (searchQuery.length >= 3) {
        console.log(
          `🔍  Searching Spotify for "${searchQuery}"... (${
            (tracks.length / trackData.length) * 100
          }%)`,
        );
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

        // Find the best match
        const fuzzyResults = fuse.search(title);
        if (fuzzyResults.length) {
          tracks.push({ track: fuzzyResults[0].item, likes, timestamp });
          logStats(fuzzyResults[0].item, author, service, likes);
        }
      }
      await sleep(1000);
    }

    return { tracks, counts, contributions, artists };
  }

  /**
   * Determine the top list of genres for the playlist
   */
  public async fetchGenres(spotify: Spotify, artistData: ArtistData[]) {
    const genres: { name: string; count: number }[] = [];
    const artistIds = artistData.map(({ id }) => id);

    // Fetch Spotify data for all the artists
    const artists = flatten(
      await Promise.all(
        chunk(artistIds, 50).map((artistChunk) =>
          spotify.getArtists(artistChunk),
        ),
      ),
    );

    artists.forEach((artist) => {
      const artistGenres = flatten(artist.genres);
      const weight = artistData.find(({ id }) => id === artist.id).count;
      artistGenres.forEach((name) => {
        const index = genres.findIndex((genre) => genre.name === name);
        if (index === -1) {
          genres.push({ name, count: weight });
        } else {
          genres[index].count += weight;
        }
      });
    });

    return genres;
  }

  /**
   * Generate a Spotify playlist
   */
  public async generatePlaylist(spotify: Spotify, weeksAgo = 1) {
    console.log(`✨  Generating playlist from ${weeksAgo} week(s) ago...`);
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

    // Fetch all messages from the channel within the past week
    const messages = await (
      await this.fetchMessages(channel, fromDate, toDate)
    ).filter((message) => !message.author.bot);
    console.log(`💬  ${messages.size} messages were sent`);

    // Parse track URLs
    const trackData = await this.parseTrackData(messages);
    console.log(`❓  ${trackData.length} contained track links`);

    // Convert URLs into Spotify URIs if possible
    const {
      tracks,
      counts,
      contributions,
      artists,
    } = await this.convertTrackData(spotify, trackData);

    // Exit if we didn't find any tracks
    if (!tracks.length) {
      console.log('⚠️  No tracks were found...');
      return;
    }

    // Determine genres from artist pages if possible
    const genres = await this.fetchGenres(spotify, artists);
    const finalTracks = uniq(
      orderBy(orderBy(tracks, 'timestamp'), 'likes').reverse(),
    );
    console.log(`🎵  ${finalTracks.length} tracks found`, counts);

    // Reset and update playlist
    if (process.env.ENVIRONMENT !== 'development') {
      console.log('🗑  Clearing playlist...');
      await spotify.clearPlaylist();
      console.log(`✏️  Renaming playlist to \"${playlistName}\"...`);
      await spotify.renamePlaylist(playlistName);
      console.log('➕  Adding tracks to playlist...');
      await spotify.addTracksToPlaylist(
        finalTracks.map(({ track }) => track.uri),
      );
      console.log(
        '✨  Playlist updated successfully',
        `https://open.spotify.com/playlist/${process.env.PLAYLIST_ID}`,
      );
    } else {
      console.log('🛑  Playlist not saved (development mode)');
    }

    // Send the news update
    const newsChannel = await this.findChannel(
      process.env.MUSIC_DESTINATION_CHANNEL_ID,
    );
    if (!newsChannel) {
      return;
    }

    let message = `✨ **${playlistName} is now available for listening!** ✨\n\n`;

    // Artists
    const popularArtists = artists.filter(
      ({ count }) => count >= ARTISTS_THRESHOLD,
    );
    if (popularArtists.length > 0) {
      message += '👩‍🎤 `Popular Artists`\n\n';
      popularArtists
        .reverse()
        .sort((a, b) => b.count - a.count)
        .slice(0, NUMBER_OF_ITEMS)
        .forEach((artist) => {
          message += `▪️ ${artist.name} (${artist.count} track${
            artist.count === 1 ? '' : 's'
          })\n`;
        });
    }

    // Genres
    if (genres.length > 0) {
      message += '\n🎸 `Dominant Genres`\n\n';
      genres
        .reverse()
        .sort((a, b) => b.count - a.count)
        .slice(0, NUMBER_OF_ITEMS)
        .forEach((genre) => {
          message += `▪️ ${capitalize(genre.name)} (${Math.round(
            (genre.count / finalTracks.length) * 100,
          )}%)\n`;
        });
    }

    // Tracks
    const popularTracks = finalTracks.filter(
      ({ likes }) => likes >= LIKE_THRESHOLD,
    );
    if (popularTracks.length > 0 && process.env.DISABLE_VOTING !== 'true') {
      message += '\n💽 `Most Liked Tracks`\n\n';
      popularTracks.slice(0, NUMBER_OF_ITEMS).forEach(({ track, likes }) => {
        message += `▪️ ${track.artists.map(({ name }) => name).join(', ')} - ${
          track.name
        } (${likes} like${likes === 1 ? '' : 's'})\n`;
      });
    }

    // Curators
    const topCountCurators = contributions.sort((a, b) => b.count - a.count);
    const topLikedCurators = topCountCurators
      .filter(({ likes }) => likes > 0)
      .sort((a, b) => b.likes - a.likes);
    const hasLikes =
      topLikedCurators.length > 0 && process.env.DISABLE_VOTING !== 'true';
    const topCurators = hasLikes ? topLikedCurators : topCountCurators;
    message += '\n🏆 `Top Curators`\n\n';
    topCurators.slice(0, NUMBER_OF_ITEMS).forEach((contribution) => {
      message += `▪️ <@${contribution.author.id}> (`;
      if (hasLikes) {
        message += `${contribution.likes} vote${
          contribution.likes === 1 ? '' : 's'
        }`;
      } else {
        message += `${contribution.count} contribution${
          contribution.count === 1 ? '' : 's'
        }`;
      }
      message += `)\n`;
    });

    // Final words
    message += `\nIn total, **${finalTracks.length} tracks** were added to the playlist.`;
    message += `\nThank you for contributing, and enjoy your listen! 🎵\nhttps://open.spotify.com/playlist/${process.env.PLAYLIST_ID}`;

    if (process.env.ENVIRONMENT !== 'development') {
      await newsChannel.send(message);
      console.log(`✨  News update sent to ${newsChannel.name}!`);
    } else {
      console.log(`🛑  News update not sent (development mode)\n`);
      console.log(message);
    }
  }
}
