import * as SpotifyWebApi from "spotify-web-api-node";
import * as fs from "fs";
import * as path from "path";

require("dotenv").config();

export default class Spotify {
  client: SpotifyWebApi;
  id?: string;
  name?: string;

  constructor() {
    this.client = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI
    });
  }

  private get authTokenFilepath() {
    return path.join(__dirname, "/../../spotify-auth-tokens.txt");
  }

  public get isAuthenticated() {
    if (this.client.getAccessToken()) {
      return true;
    }
    try {
      const tokens = fs
        .readFileSync(this.authTokenFilepath, {
          encoding: "utf8"
        })
        .split("\n");
      this.setTokens(tokens[0], tokens[1]);
      return !!this.client.getAccessToken();
    } catch (e) {
      return false;
    }
  }

  public get authorizationUrl() {
    return this.client.createAuthorizeURL(
      ["playlist-modify-public", "playlist-modify-private"],
      new Date().getTime().toString()
    );
  }

  private setTokens(accessToken, refreshToken) {
    this.client.setAccessToken(accessToken);
    if (refreshToken) {
      this.client.setRefreshToken(refreshToken);
    }
    fs.writeFileSync(
      this.authTokenFilepath,
      `${accessToken}\n${refreshToken || this.client.getRefreshToken()}`
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
  }

  private async getAccountDetails() {
    const response = await this.client.getMe();
    this.id = response.body.id;
    this.name = response.body.display_name;
  }

  public get accountName() {
    return `${this.name} (#${this.id})`;
  }

  public async createPlaylist(name: string) {
    const response = await this.client.createPlaylist(this.id, name);
    return response.body;
  }
}
