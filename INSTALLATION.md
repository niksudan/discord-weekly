# Installation

Discord Weekly is a self-hosted bot, so you will need some server-side knowledge before installing.

The bot runs on Node.js, and will be fine on most Ubuntu-based platforms.

## Prerequisites

You will need to have [Node.js 12 or higher](https://nodejs.org) installed, and also the command line packager [Yarn](https://yarnpkg.com/).

- Install dependencies with `yarn install`
- Copy `.env.example` over to `.env`

You will also need the following:

- A Discord server, with permission to invite a bot
- A Spotify premium account (this is where the playlist will be hosted)

## Creating a Discord Bot

- Navigate to [Discord Developer Portal](https://discordapp.com/developers/applications) and click "New Application"
- Click the "Bot" setting to the left, and enable the bot user option
- Give your bot a cool name, and choose a family friendly avatar 😇
- Copy the token it generates for you and paste it after the `DISCORD_TOKEN` variable in your `.env` file

## Invite your Bot

On the Discord Developer Portal, you should have a URL like this open:

```
https://discordapp.com/developers/applications/123456/bot
```

Copy the number right before `/bot` and paste it after the `client_id` variable in this URL:

```
https://discordapp.com/api/oauth2/authorize?client_id=<CLIENT_ID_HERE>&permissions=0&scope=bot
```

Visit the link in your browser, and you should be able to invite the bot to your Discord server.

## Creating a Spotify Application

- Navigate to [Spotify for Developers](https://developer.spotify.com/dashboard/) and click "Create a Client ID"
- Copy the Client ID and paste it after the `SPOTIFY_CLIENT_ID` variable in your `.env` file
- Copy the Client Secret and paste it after the `SPOTIFY_CLIENT_SECRET` variable in your `.env` file

## Configuring Environment

By now, you should have set up a few variables inside your `.env` file. You'll need to populate most of the others in order for your bot to run.

You will need to [enable developer mode](https://www.discordia.me/en/developer-mode) on Discord to get some of these values.

| Variable                       | Description                                  | How to Get                                                                                                  |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`                | Discord bot token                            | Discord Developer Portal                                                                                    |
| `DISCORD_GUILD_ID`             | Discord server ID                            | Right click on your server dropdown                                                                         |
| `SPOTIFY_CLIENT_ID`            | Spotify application client ID                | Spotify for Developers                                                                                      |
| `SPOTIFY_CLIENT_SECRET`        | Spotify application client secret            | Spotify for Developers                                                                                      |
| `SPOTIFY_REDIRECT_URI`         | Callback URL of the server                   | Your IP address and port as a URL, followed by `/callback`                                                  |
| `SERVER_PORT`                  | Server port the bot runs on                  | Choose something that's not in use                                                                          |
| `PLAYLIST_ID`                  | ID of the Spotify playlist                   | Create a Spotify playlist and get the last part of the "Spotify URI" value (get rid of `spotify:playlist:`) |
| `PLAYLIST_NAME`                | Name of the Spotify playlist                 | Think                                                                                                       |
| `MUSIC_SOURCE_CHANNEL_ID`      | Discord channel ID where to get songs from   | Right click on the channel                                                                                  |
| `MUSIC_DESTINATION_CHANNEL_ID` | Discord channel ID where to post playlist to | Right click on the channel                                                                                  |

## First Time Setup

If everything worked correctly, you may now run `yarn generate-playlist` in this directory.

You should get the following message(s):

```
WARNING: Spotify features won't work until you log in

Spotify auth server is live at https://localhost:9000
```

Navigate to the server URL of your application (Your IP address and port as a URL, e.g. http://127.0.0.1:9000.

Sign in to your Spotify account and continue. You should be taken to a page with the word "OK".

Stop the bot and re-run `yarn generate-playlist`. If all went well, you should start to get output in the console. Make sure that there are some valid links in the chat posted in the last week, otherwise nothing will happen.

## Running Weekly

You'll need to setup a cron job to execute the command on a weekly basis. Run `crontab -e` and add the following line:

```
0 0 * * 1 cd /<PROJECT_PATH> && yarn generate-playlist
```

This will make the bot generate a playlist every Monday at 00:00 server time. Feel free to [add whatever interval you like](https://crontab.guru/).
