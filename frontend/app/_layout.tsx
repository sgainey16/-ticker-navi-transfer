import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { FollowsProvider } from "@/src/lib/follows";

// Disable logbox so users see the app cleanly.
LogBox.ignoreAllLogs(true);

// Keep native splash until icon fonts register (prewarm fix — do not remove).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconErr] = useIconFonts();
  const [appLoaded, appErr] = useFonts({
    Rajdhani: require("../assets/fonts/Rajdhani-Bold.ttf"),
    "Rajdhani-SemiBold": require("../assets/fonts/Rajdhani-SemiBold.ttf"),
    "Rajdhani-Medium": require("../assets/fonts/Rajdhani-Medium.ttf"),
    Oswald: require("../assets/fonts/Oswald.ttf"),
    Inter: require("../assets/fonts/Inter.ttf"),
  });

  const ready = (iconsLoaded || iconErr) && (appLoaded || appErr);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <StatusBar style="light" />
          <FollowsProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#05070C" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
              <Stack.Screen name="talk" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="voices" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="recap/[id]" options={{ animation: "slide_from_right" }} />
            </Stack>
          </FollowsProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
