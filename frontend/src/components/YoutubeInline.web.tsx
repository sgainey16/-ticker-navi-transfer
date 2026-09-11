import React from "react";
import { View } from "react-native";

// Web build: never import react-native-youtube-iframe (it requires a web webview
// shim that isn't installed and breaks the bundle). On web the module opens the
// verified source URL directly via Linking, so this inline player is unused.
export default function YoutubeInline({ videoId, height = 220 }: { videoId: string; height?: number }) {
  return <View style={{ height, width: "100%" }} />;
}
