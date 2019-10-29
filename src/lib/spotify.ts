import * as SpotifyWebApi from 'spotify-web-api-node';
import * as fs from 'fs';
import * as path from 'path';

require('dotenv').config();

interface SpotifyTrack {
  uri: string;
  name: string;
  popularity: number;
  album: string;
  artists: string[];
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
    console.log('Logged in to Spotify as', this.accountName);
  }

  private async getAccountDetails() {
    const response = await this.client.getMe();
    this.id = response.body.id;
    this.name = response.body.display_name;
  }

  public async renamePlaylist(name: string) {
    console.log(`Renaming playlist to \"${name}\"...`);
    await this.client.changePlaylistDetails(process.env.PLAYLIST_ID, {
      name,
    });
  }

  public async addTracksToPlaylist(tracks: string[]) {
    console.log('Adding tracks to playlist...');
    return this.client.addTracksToPlaylist(process.env.PLAYLIST_ID, tracks);
  }

  public async clearPlaylist() {
    console.log('Clearing playlist...');
    const response = await this.client.getPlaylistTracks(
      process.env.PLAYLIST_ID,
    );
    const tracks = response.body.items.map(item => ({
      uri: item.track.uri,
    }));
    return this.client.removeTracksFromPlaylist(
      process.env.PLAYLIST_ID,
      tracks,
    );
  }

  public async searchTracks(
    query: string,
    limit = 10,
  ): Promise<SpotifyTrack[]> {
    console.log(`Searching for tracks about "${query}"...`);
    const response = await this.client.searchTracks(query, { limit });
    return response.body.tracks.items.map(item => ({
      uri: item.uri,
      name: item.name,
      popularity: item.popularity,
      album: item.album.name,
      artists: item.artists.map(artist => artist.name),
    }));
  }
}
