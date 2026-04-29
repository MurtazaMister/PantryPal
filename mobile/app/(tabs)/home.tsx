import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { RecipeCard } from "../../src/components/RecipeCard";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { isExpiringSoon } from "../../src/lib";
import { useAppStore } from "../../src/store/useAppStore";

export default function HomeScreen() {
  const pantryItems = useAppStore((state) => state.pantryItems);
  const latestRecommendations = useAppStore((state) => state.latestRecommendations);
  const generateRecommendations = useAppStore((state) => state.generateRecommendations);
  const memorySummary = useAppStore((state) => state.memorySummary);
  const undoEvent = useAppStore((state) => state.undoEvent);
  const undoLastPantryUpdate = useAppStore((state) => state.undoLastPantryUpdate);

  const expiring = pantryItems.filter(isExpiringSoon);
  const lowStock = pantryItems.filter((item) => item.isLowStock);
  const topRecipes =
    latestRecommendations.length > 0
      ? latestRecommendations
      : generateRecommendations({ availability: "prioritize-expiring", mealType: "dinner", maxMinutes: 30 }, "");

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Tonight looks easy.</Text>
        <Text style={styles.subtitle}>
          {pantryItems.length} pantry items, {expiring.length} expiring soon, and a strong bias toward {memorySummary.topCuisines[0]} food.
        </Text>
      </View>

      <View style={styles.quickRow}>
        <QuickAction label="Add grocery" onPress={() => router.push("/(tabs)/shopping")} />
        <QuickAction label="View pantry" onPress={() => router.push("/(tabs)/pantry")} />
        <QuickAction label="Log meal" onPress={() => router.push("/meal-log")} />
      </View>

      {undoEvent ? (
        <Pressable onPress={undoLastPantryUpdate} style={styles.undo}>
          <Text style={styles.undoText}>{undoEvent.label}</Text>
        </Pressable>
      ) : null}

      <SectionCard title="Kitchen snapshot">
        <View style={styles.statsRow}>
          <Stat label="Pantry items" value={`${pantryItems.length}`} />
          <Stat label="Use soon" value={`${expiring.length}`} />
          <Stat label="Low stock" value={`${lowStock.length}`} />
        </View>
      </SectionCard>

      <SectionCard title="Top recipes" subtitle="Tailored using pantry coverage, expiring items, and memory from past cooking.">
        {topRecipes.length ? (
          topRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onPress={() => router.push(`/recipe/${recipe.id}`)} />
          ))
        ) : (
          <EmptyState title="Your pantry is empty" body="Add a few groceries and PantryPal will start ranking meals you can make now." />
        )}
      </SectionCard>
    </Screen>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#10241b",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#56675d",
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 16,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "#163a2a",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  quickActionText: {
    color: "#f6fbf6",
    fontWeight: "700",
    fontSize: 13,
  },
  undo: {
    backgroundColor: "#fef3c7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  undoText: {
    color: "#7c5300",
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: "#f3f7f1",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#163627",
  },
  statLabel: {
    color: "#66776b",
    fontSize: 12,
  },
});
