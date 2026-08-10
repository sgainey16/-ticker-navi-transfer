import React from "react";
import YoutubePlayer from "react-native-youtube-iframe";

// Native player: contained YouTube playback that stays INSIDE the app.
export function YTPlayer({ videoId, height }: { videoId: string; height: number }) {
  return (
    <YoutubePlayer
      height={height}
      videoId={videoId}
      play={false}
      webViewStyle={{ opacity: 0.99, backgroundColor: "#000" }}
      initialPlayerParams={{ modestbranding: true, rel: false, controls: true }}
      webViewProps={{ allowsInlineMediaPlayback: true, androidLayerType: "hardware" }}
    />
  );
}
