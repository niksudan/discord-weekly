import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default class SoundCloud {
  public static match(content: string) {
    return content.match(/https:\/\/soundcloud.com\/(\S+)/gi);
  }

  public static async get(url: string): Promise<string> {
    const html = await fetch(url).then((res) => res.text());
    const $ = cheerio.load(html);

    const fullTitle = $('title').text();
    const title = $('meta[property="og:title"]').attr('content');
    const artist = fullTitle
      .replace(`${title} by `, '')
      .replace(' | Free Listening on SoundCloud', '');

    return `${title} - ${artist}`;
  }
}
