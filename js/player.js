// Creates the playable media element for one tile's stream config.
// stream: { type: 'hls' | 'iframe', url, label }
export function createTileMedia(stream) {
  if (stream.type === "iframe") {
    const iframe = document.createElement("iframe");
    iframe.src = stream.url;
    iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "no-referrer";
    iframe.style.border = "0";
    return {
      el: iframe,
      kind: "iframe",
      destroy() {
        iframe.src = "about:blank";
      },
      setMuted() {
        // Cross-origin iframes can't be muted from the parent page.
      },
    };
  }

  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.controls = false;

  let hls = null;
  const canUseHlsJs = stream.type === "hls" && window.Hls && window.Hls.isSupported();
  if (canUseHlsJs) {
    hls = new window.Hls();
    // attachMedia must come before loadSource — loading the source first
    // races the MediaSource attach and can leave playback silently stalled.
    hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(stream.url));
    hls.attachMedia(video);
  } else {
    video.src = stream.url;
  }
  video.play().catch(() => {});

  return {
    el: video,
    kind: "video",
    destroy() {
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
    setMuted(muted) {
      video.muted = muted;
    },
  };
}
