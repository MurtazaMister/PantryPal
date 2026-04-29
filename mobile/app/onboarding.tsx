import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { SectionCard } from "../src/components/SectionCard";
import { useAppStore } from "../src/store/useAppStore";

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  function start(mode: "demo" | "fresh") {
    completeOnboarding(mode);
    router.replace("/(tabs)/home");
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PantryPal</Text>
        <Text style={styles.title}>A live pantry that tells you what to cook before food goes to waste.</Text>
        <Text style={styles.body}>
          Shopping turns into pantry. Pantry turns into meals. Cooking turns back into updated inventory with AI review before anything changes.
        </Text>
      </View>

      <SectionCard title="Judge-ready flow" subtitle="Designed to show the full loop in under three minutes.">
        <Text style={styles.listItem}>
          Shopping list {"->"} bought items {"->"} pantry {"->"} recipe suggestions {"->"} cook {"->"} review deductions {"->"} updated pantry
        </Text>
        <Text style={styles.listItem}>Meal reminders bring the user back at breakfast, lunch, and dinner, then ask for a quick log after eating.</Text>
      </SectionCard>

      <Pressable style={[styles.button, styles.primary]} onPress={() => start("demo")}>
        <Text style={styles.primaryLabel}>Open demo pantry</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.secondary]} onPress={() => start("fresh")}>
        <Text style={styles.secondaryLabel}>Start fresh</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 12,
    paddingVertical: 20,
  },
  eyebrow: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f5138",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: "#11271b",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4d5f54",
  },
  listItem: {
    color: "#445448",
    lineHeight: 21,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 14,
  },
  primary: {
    backgroundColor: "#153a2a",
  },
  secondary: {
    backgroundColor: "#dfe9df",
  },
  primaryLabel: {
    color: "#f8fbf8",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryLabel: {
    color: "#173225",
    fontSize: 16,
    fontWeight: "700",
  },
});
