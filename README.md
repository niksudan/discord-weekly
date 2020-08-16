# Discord Weekly

Create a weekly Spotify playlist from Discord server messages

## Overview

This bot retrieves the last week's worth of songs in a channel and then updates a Spotify playlist with the results.

Song are added to the playlist if it is in one of the following formats:

- Spotify track URL
- YouTube video URL
- Apple Music track URL
- SoundCloud track URL

After each new playlist, a message is posted to a channel that will show the following information:

- Popular artists (with total tracks)
- Dominant genres (with percentages)
- Most liked tracks (with total like score)
- Top curators (with total votes/contributions)
- Number of tracks & playlist link

## Reacting to Songs

If a song gets reacted with a 👍, this is counted as a **like**. The more likes a song gets, the higher it will appear in the playlist.

If a song gets reacted with a 👎, this is counted as a **dislike**. This subtracts from the total number of likes. If a song is disliked enough, it will not appear in the playlist.

If users are using the voting system, the "Top curators" section will be based off total number of votes. If there are none, or the total is equal to 0, then it will use total contributions instead. Users with 0 votes do not get shown.

## Installation

Discord Weekly is a self-hosted bot, so you will need some server-side knowledge before installing.

[➡️ View installation instructions](INSTALLATION.md)
