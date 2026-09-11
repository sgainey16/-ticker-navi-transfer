import React from "react";
import YoutubePlayer from "react-native-youtube-iframe";

// Native inline YouTube player (iOS/Android). Web uses YoutubeInline.web.tsx.
export default function YoutubeInline({ videoId, height = 220 }: { videoId: string; height?: number }) {
  return <YoutubePlayer height={height} play videoId={videoId} />;
}
