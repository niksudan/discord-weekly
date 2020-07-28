import express from 'express';
import * as bodyParser from 'body-parser';
import Spotify from './spotify';

export default class Server {
  constructor(spotify: Spotify) {
    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/', async (req, res) => {
      if (spotify.isAuthenticated) {
        await spotify.refreshTokens();
        res.sendStatus(200);
      }
      res.redirect(spotify.authorizationUrl);
    });

    app.get('/callback', async (req, res) => {
      if (spotify.isAuthenticated) {
        await spotify.refreshTokens();
        res.sendStatus(200);
      }
      try {
        await spotify.login(req.query.code.toString());
        res.sendStatus(200);
      } catch (e) {
        res.sendStatus(404);
      }
    });

    app.set('port', process.env.SERVER_PORT || 9000);
    app.listen(app.get('port'), () => {
      console.log(
        `Spotify auth server is live at http://localhost:${app.get('port')}`,
      );
    });
  }
}
