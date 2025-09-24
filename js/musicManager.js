// js/musicManager.js

class MusicManager {
  constructor() {
    this.tracks = {};
    this.currentTrack = null;
    this.audioContextUnlocked = false;
    this.volume = 0.3; // بلندی صدای پیش‌فرض
    this.fadeDuration = 1000; // مدت زمان محو شدن آهنگ (۱ ثانیه)

    this.preloadTracks();
    this.unlockAudioContext();
  }

  preloadTracks() {
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

  unlockAudioContext() {
    const unlock = () => {
      if (this.audioContextUnlocked) return;

      // تلاش برای فعال‌سازی صداها
      const promises = Object.values(this.tracks).map((track) => {
        const playPromise = track.play();
        if (playPromise !== undefined) {
          return playPromise.then(() => track.pause()).catch(() => {});
        }
        return Promise.resolve();
      });

      Promise.all(promises).then(() => {
        this.audioContextUnlocked = true;
        console.log("Audio context unlocked.");
        // <<< تغییر اصلی اینجاست >>>
        // بعد از اینکه صدا با موفقیت فعال شد، موسیقی منو را پخش کن
        this.play("menu");
      });

      document.body.removeEventListener("click", unlock);
      document.body.removeEventListener("touchstart", unlock);
    };

    document.body.addEventListener("click", unlock, { once: true });
    document.body.addEventListener("touchstart", unlock, { once: true });
  }

  play(trackName) {
    // اگر صدا هنوز فعال نشده، پخش را انجام نده (تابع unlock این کار را خواهد کرد)
    if (!this.audioContextUnlocked) {
      console.warn("Audio context not unlocked yet. Playback deferred.");
      return;
    }

    if (
      !this.tracks[trackName] ||
      (this.currentTrack && this.currentTrack.name === trackName)
    ) {
      return;
    }

    if (this.currentTrack) {
      this.fadeOut(this.currentTrack.audio);
    }

    const newTrack = this.tracks[trackName];
    this.currentTrack = { name: trackName, audio: newTrack };

    const playPromise = newTrack.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // این خطا دیگر نباید رخ دهد، اما برای اطمینان آن را نگه می‌داریم
        console.warn(
          `پخش خودکار موسیقی '${trackName}' توسط مرورگر متوقف شد:`,
          error
        );
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
    if (audio.fadeInterval) clearInterval(audio.fadeInterval);
    audio.fadeInterval = setInterval(() => {
      currentVolume += fadeStep;
      if (currentVolume >= this.volume) {
        audio.volume = this.volume;
        clearInterval(audio.fadeInterval);
      } else {
        audio.volume = currentVolume;
      }
    }, 50);
  }

  fadeOut(audio) {
    let currentVolume = audio.volume;
    const fadeStep = currentVolume / (this.fadeDuration / 50);
    if (audio.fadeInterval) clearInterval(audio.fadeInterval);
    audio.fadeInterval = setInterval(() => {
      currentVolume -= fadeStep;
      if (currentVolume <= 0) {
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0;
        clearInterval(audio.fadeInterval);
      } else {
        audio.volume = currentVolume;
      }
    }, 50);
  }
}

window.musicManager = new MusicManager();
