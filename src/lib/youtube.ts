import fetch from 'node-fetch';
import * as queryString from 'query-string';
const getYouTubeID = require('get-youtube-id');

export default class YouTube {
  public static match(content: string) {
    return content.match(
      /http(s)?:\/\/((w){3}.)?youtu(be|.be)?(\.com)?\/([^\s]+)/gi,
    );
  }

  public static async get(url: string): Promise<string> {
    const id = getYouTubeID(url);
    if (!id) {
      return '';
    }

    try {
      const response = await fetch(
        `http://youtube.com/get_video_info?html5=1&video_id=${id}`,
      ).then((res) => res.text());
      const query = queryString.parse(response);
      const { videoDetails } = JSON.parse(query.player_response.toString());
      if (!videoDetails) {
        return '';
      }
      return videoDetails.title;
    } catch (e) {
      console.log('Error with YouTube:', e.message);
    }
  }
}
