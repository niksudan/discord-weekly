import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default class AppleMusic {
  public static match(content: string) {
    return content.match(/https:\/\/music.apple.com\/(\S+)\/album\/(\S+)/gi);
  }

  public static async get(url: string): Promise<string> {
    const html = await fetch(url).then((res) => res.text());
    const $ = cheerio.load(html);

    const fullTitle = $('meta[property="og:title"]').attr('content');
    const title = $('meta[name="apple:title"]').attr('content');
    const artist = fullTitle.replace(`${title} by `, '');

    return `${title} - ${artist}`;
  }
}
