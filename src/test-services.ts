import AppleMusic from './lib/apple';
import SoundCloud from './lib/soundcloud';

(async () => {
  const appleMusic = await AppleMusic.get(
    'https://music.apple.com/us/album/hold-me-close/1522945521?i=1522945522',
  );
  console.log('Apple Music:', appleMusic);

  const soundcloud = await SoundCloud.get(
    'https://soundcloud.com/niksudan/let-me-go',
  );
  console.log('SoundCloud:', soundcloud);
})();
