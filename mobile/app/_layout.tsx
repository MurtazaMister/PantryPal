import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as SystemUI from "expo-system-ui";

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#f4f7f1").catch(() => undefined);
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#f4f7f1" },
          headerTintColor: "#163627",
          headerBackTitle: "Back",
          headerBackVisible: true,
          contentStyle: { backgroundColor: "#f4f7f1" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ title: "Recipe" }} />
        <Stack.Screen name="recipe-chat/[id]" options={{ title: "Recipe Chat" }} />
        <Stack.Screen name="meal-log" options={{ title: "Log meal" }} />
        <Stack.Screen name="deduction-review/[draftId]" options={{ title: "Review deductions" }} />
      </Stack>
    </>
  );
}
