import SpotifyWebApi from 'spotify-web-api-node';
import * as fs from 'fs';
import * as path from 'path';
import { chunk } from 'lodash';

require('dotenv').config();

export interface SpotifyTrack {
  uri: string;
  name: string;
  popularity: number;
  artists: {
    name: string;
    id: string;
  }[];
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export default class Spotify {
  client: SpotifyWebApi;
  id?: string;
  name?: string;

  constructor() {
    this.client = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    });
  }

  public static match(content: string) {
    return content.match(/https:\/\/open.spotify.com\/track\/(\w+)/gi);
  }

  private get authTokenFilepath() {
    return path.join(__dirname, '/../../spotify-auth-tokens.txt');
  }

  public get isAuthenticated() {
    if (this.client.getAccessToken()) {
      return true;
    }
    try {
      const tokens = fs
        .readFileSync(this.authTokenFilepath, {
          encoding: 'utf8',
        })
        .split('\n');
      this.setTokens(tokens[0], tokens[1]);
      return !!this.client.getAccessToken();
    } catch (e) {
      return false;
    }
  }

  public get authorizationUrl() {
    return this.client.createAuthorizeURL(
      ['playlist-modify-public', 'playlist-modify-private'],
      new Date().getTime().toString(),
    );
  }

  public get accountName() {
    return `${this.name} (#${this.id})`;
  }

  private setTokens(accessToken, refreshToken) {
    this.client.setAccessToken(accessToken);
    if (refreshToken) {
      this.client.setRefreshToken(refreshToken);
    }
    fs.writeFileSync(
      this.authTokenFilepath,
      `${accessToken}\n${refreshToken || this.client.getRefreshToken()}`,
    );
  }

  public async login(code: string) {
    const response = await this.client.authorizationCodeGrant(code);
    this.setTokens(response.body.access_token, response.body.refresh_token);
    await this.getAccountDetails();
  }

  public async refreshTokens() {
    const response = await this.client.refreshAccessToken();
    this.setTokens(response.body.access_token, response.body.refresh_token);
    await this.getAccountDetails();
    console.log('✅  Logged in to Spotify as', this.accountName);
  }

  private async getAccountDetails() {
    const response = await this.client.getMe();
    this.id = response.body.id;
    this.name = response.body.display_name;
  }

  public async renamePlaylist(name: string) {
    console.log(`✏️  Renaming playlist to \"${name}\"...`);
    await this.client.changePlaylistDetails(process.env.PLAYLIST_ID, {
      name,
    });
  }

  public async addTracksToPlaylist(tracks: string[]) {
    const TRACKS_PER_PAYLOAD = 99;
    const payloads = chunk(tracks, TRACKS_PER_PAYLOAD);
    for (let i = 0; i < payloads.length; i += 1) {
      console.log(
        `➕  Adding tracks ${i * TRACKS_PER_PAYLOAD}-${
          i * TRACKS_PER_PAYLOAD + TRACKS_PER_PAYLOAD
        } to playlist...`,
      );
      const payload = payloads[i];
      await this.client.addTracksToPlaylist(process.env.PLAYLIST_ID, payload);
    }
  }

  public async clearPlaylist() {
    console.log('🗑  Clearing playlist...');
    const response = await this.client.getPlaylistTracks(
      process.env.PLAYLIST_ID,
    );

    const tracks: { uri: string }[] = response.body.items.map((item) => ({
      uri: item.track.uri,
    }));
    const tracksToRemove = tracks.slice(0, 50);

    await this.client.removeTracksFromPlaylist(
      process.env.PLAYLIST_ID,
      tracksToRemove,
    );

    if (tracksToRemove.length > 0) {
      return new Promise((resolve) => {
        setTimeout(async () => {
          await this.clearPlaylist();
          resolve();
        }, 500);
      });
    }
  }

  public async getTrack(id: string): Promise<SpotifyTrack> {
    const response = await this.client.getTrack(id);
    return {
      uri: response.body.uri,
      name: response.body.name,
      popularity: response.body.popularity,
      artists: response.body.artists.map(({ id, name }) => ({ id, name })),
    };
  }

  public async searchTracks(query: string, limit = 5): Promise<SpotifyTrack[]> {
    console.log(`🔍  Searching Spotify for "${query}"...`);
    const response = await this.client.searchTracks(query, { limit });
    return response.body.tracks.items.map((item) => ({
      uri: item.uri,
      name: item.name,
      popularity: item.popularity,
      artists: item.artists.map(({ id, name }) => ({ id, name })),
    }));
  }

  public async getArtists(ids: string[]): Promise<SpotifyArtist[]> {
    const response = await this.client.getArtists(ids);
    return response.body.artists
      .filter((item) => !!item)
      .map((item) => ({
        id: item.id,
        name: item.name,
        genres: item.genres,
      }));
  }
}
