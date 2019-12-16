# ninbot [![Add to Discord](https://img.shields.io/badge/Add%20to-Discord-7289da.svg)](https://discordapp.com/api/oauth2/authorize?client_id=594276600892358666&permissions=0&scope=bot)

**ninbot** is a Discord bot created specifically for the Nine Inch Nails Discord server.

## 🎵 NINcord Weekly

ninbot retrieves the last week's worth of songs in `#non-nin-music` and then updates a [Spotify playlist](https://open.spotify.com/playlist/1pMms99VVgmLZhkr2MN010?si=0YvWAK2aR-yik6-OcV_g7g) with the results.

Your song will be added to the playlist if it is in one of the following formats:

- Spotify track (ninbot ignores album links for now)
- YouTube video (ninbot will try it's best to match)

The playlist updates every Monday at 00:00 UTC. In addition, a message is posted to `#nincord-weekly` that will mention the top 5 contributors of that week.
