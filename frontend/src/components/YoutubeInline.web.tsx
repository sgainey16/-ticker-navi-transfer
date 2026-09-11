import React from "react";

// Web build: render a real inline <iframe> so verified highlights play INSIDE Ticker
// (never bounce out to youtube.com). react-native-web renders through react-dom,
// so a raw DOM iframe element is valid here. Native uses YoutubeInline.tsx.
export default function YoutubeInline({ videoId, height = 220 }: { videoId: string; height?: number }) {
  return React.createElement("iframe", {
    src: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`,
    width: "100%",
    height,
    frameBorder: 0,
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    allowFullScreen: true,
    style: { border: 0, borderRadius: 10, width: "100%" },
    title: "highlight",
  });
}
