import fetch from 'node-fetch';
import * as queryString from 'query-string';
const getYouTubeID = require('get-youtube-id');

interface YouTubeVideo {
  id: string;
  title: string;
}

export default class YouTube {
  public static async getVideo(url: string): Promise<YouTubeVideo> {
    const id = getYouTubeID(url);
    if (!id) {
      return;
    }

    const response = await fetch(
      `http://youtube.com/get_video_info?html5=1&video_id=${id}`,
    ).then(res => res.text());

    const query = queryString.parse(response);
    const { videoDetails } = JSON.parse(query.player_response.toString());
    
    if (!videoDetails) {
      return;
    }

    return {
      id: videoDetails.videoId,
      title: videoDetails.title,
    };
  }
}
