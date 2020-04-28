# Discord Weekly

Create a weekly Spotify playlist from Discord server messages

## Overview

This bot retrieves the last week's worth of songs in a channel and then updates a Spotify playlist with the results.

Song are added to the playlist if it is in one of the following formats:

- Spotify track (will ignore album links for now)
- YouTube video (will try it's best to match)

After each new playlist, a message is posted to a channel that will mention the top 5 contributors of that week.

## Installation

Discord Weekly is a self-hosted bot, so you will need some server-side knowledge before installing.

[➡️ View installation instructions](INSTALLATION.md)
