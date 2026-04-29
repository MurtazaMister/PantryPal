import { Redirect } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAppStore } from "../src/store/useAppStore";

export default function IndexScreen() {
  const initializeIdentity = useAppStore((state) => state.initializeIdentity);
  const identityReady = useAppStore((state) => state.identityReady);
  const complete = useAppStore((state) => state.profile.onboardingComplete);

  useEffect(() => {
    initializeIdentity().catch(() => undefined);
  }, [initializeIdentity]);

  if (!identityReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f7f1" }}>
        <ActivityIndicator color="#153a2a" />
      </View>
    );
  }

  return <Redirect href={complete ? "/(tabs)/home" : "/onboarding"} />;
}
