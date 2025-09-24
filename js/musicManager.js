class MusicManager {
  constructor() {
    this.tracks = {};
    this.currentTrack = null;
    this.volume = 0.3; // بلندی صدای پیش‌فرض (می‌توانید تغییر دهید)
    this.fadeDuration = 1000; // مدت زمان محو شدن آهنگ (۱ ثانیه)

    this.preloadTracks();
    this.unlockAudioContext();
  }

  preloadTracks() {
    // فرض می‌کنیم آهنگ‌ها در این مسیر قرار دارند. اگر مسیر دیگری است، آن را اصلاح کنید.
    const trackPaths = {
      menu: "assets/sounds/menu/menu.wav",
      waiting: "assets/sounds/menu/waiting.wav",
      war: "assets/sounds/menu/war.wav",
    };

    for (const [name, path] of Object.entries(trackPaths)) {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = 0; // شروع با صدای صفر برای افکت fade-in
      this.tracks[name] = audio;
    }
  }

  // این تابع برای رفع محدودیت پخش خودکار صدا در مرورگرهاست
  unlockAudioContext() {
    document.body.addEventListener(
      "click",
      () => {
        Object.values(this.tracks).forEach((track) => {
          track.play().then(() => track.pause());
        });
      },
      { once: true }
    );
  }

  play(trackName) {
    if (
      !this.tracks[trackName] ||
      (this.currentTrack && this.currentTrack.name === trackName)
    ) {
      return; // اگر آهنگ در حال پخش است، دوباره پخشش نکن
    }

    // قطع کردن و محو کردن آهنگ قبلی
    if (this.currentTrack) {
      this.fadeOut(this.currentTrack.audio);
    }

    // پخش و نمایان کردن آهنگ جدید
    const newTrack = this.tracks[trackName];
    this.currentTrack = { name: trackName, audio: newTrack };

    const playPromise = newTrack.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn(`پخش خودکار موسیقی '${trackName}' توسط مرورگر متوقف شد.`);
      });
    }
    this.fadeIn(newTrack);
  }

  stop() {
    if (this.currentTrack) {
      this.fadeOut(this.currentTrack.audio);
      this.currentTrack = null;
    }
  }

  fadeIn(audio) {
    let currentVolume = 0;
    audio.volume = 0;
    const fadeStep = this.volume / (this.fadeDuration / 50);

    const fadeInterval = setInterval(() => {
      currentVolume += fadeStep;
      if (currentVolume >= this.volume) {
        audio.volume = this.volume;
        clearInterval(fadeInterval);
      } else {
        audio.volume = currentVolume;
      }
    }, 50);
  }

  fadeOut(audio) {
    let currentVolume = audio.volume;
    const fadeStep = currentVolume / (this.fadeDuration / 50);

    const fadeInterval = setInterval(() => {
      currentVolume -= fadeStep;
      if (currentVolume <= 0) {
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0; // بازگشت به ابتدای آهنگ
        clearInterval(fadeInterval);
      } else {
        audio.volume = currentVolume;
      }
    }, 50);
  }
}
