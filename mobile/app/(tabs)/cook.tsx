import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { RecipeCard } from "../../src/components/RecipeCard";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { useAppStore } from "../../src/store/useAppStore";
import type { RecommendationFilters } from "../../src/types";

const defaultFilters: RecommendationFilters = {
  availability: "prioritize-expiring",
  mealType: "dinner",
  maxMinutes: 30,
  cuisine: "Indian",
  equipment: "stove",
};

const TIME_OPTIONS: Array<{ label: string; value: 15 | 30 | 60 }> = [
  { label: "Under 15 min", value: 15 },
  { label: "Under 30 min", value: 30 },
  { label: "Under 60 min", value: 60 },
];

const AVAILABILITY_OPTIONS: Array<{
  label: string;
  value: RecommendationFilters["availability"];
}> = [
  { label: "Cookable now", value: "cookable-now" },
  { label: "Missing 1-2", value: "missing-a-few" },
  { label: "Prioritize expiring", value: "prioritize-expiring" },
];

export default function CookScreen() {
  const selectedMealType = useAppStore((state) => state.selectedMealType);
  const setSelectedMealType = useAppStore((state) => state.setSelectedMealType);
  const generateRecommendations = useAppStore((state) => state.generateRecommendations);
  const latestRecommendations = useAppStore((state) => state.latestRecommendations);
  const memorySummary = useAppStore((state) => state.memorySummary);

  const [prompt, setPrompt] = useState("Indian dinner for 3 people");
  const [filters, setFilters] = useState<RecommendationFilters>({
    ...defaultFilters,
    mealType: selectedMealType,
  });

  const safeFilters = useMemo(
    () => ({ ...filters, mealType: selectedMealType }),
    [filters, selectedMealType],
  );

  useEffect(() => {
    generateRecommendations(safeFilters, prompt);
  }, []);

  function applyFilters(next: RecommendationFilters) {
    setFilters(next);
    generateRecommendations(next, prompt);
  }

  return (
    <Screen>
      <SectionCard
        title="Cook from your pantry"
        subtitle="Filters are selectable and recommendations always use your latest prompt + filters."
      >
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask for something specific"
        />

        <View style={styles.row}>
          {(["breakfast", "lunch", "dinner"] as const).map((mealType) => (
            <Pressable
              key={mealType}
              style={[styles.filterChip, selectedMealType === mealType && styles.filterChipActive]}
              onPress={() => {
                setSelectedMealType(mealType);
                applyFilters({ ...safeFilters, mealType });
              }}
            >
              <Text style={[styles.filterLabel, selectedMealType === mealType && styles.filterLabelActive]}>
                {mealType}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.groupLabel}>Time filter</Text>
        <View style={styles.row}>
          {TIME_OPTIONS.map((entry) => (
            <Pressable
              key={entry.value}
              style={[styles.control, safeFilters.maxMinutes === entry.value && styles.controlActive]}
              onPress={() => applyFilters({ ...safeFilters, maxMinutes: entry.value })}
            >
              <Text style={[styles.controlText, safeFilters.maxMinutes === entry.value && styles.controlTextActive]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.groupLabel}>Availability</Text>
        <View style={styles.row}>
          {AVAILABILITY_OPTIONS.map((entry) => (
            <Pressable
              key={entry.value}
              style={[styles.control, safeFilters.availability === entry.value && styles.controlActive]}
              onPress={() => applyFilters({ ...safeFilters, availability: entry.value })}
            >
              <Text style={[styles.controlText, safeFilters.availability === entry.value && styles.controlTextActive]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.button} onPress={() => generateRecommendations(safeFilters, prompt)}>
          <Text style={styles.buttonText}>Generate recipes</Text>
        </Pressable>

        <Text style={styles.memoryText}>
          Memory bias: {memorySummary.topCuisines.join(", ")} - {memorySummary.preferredTimeRange} -{" "}
          {memorySummary.preferredEquipment.join(", ")}
        </Text>
      </SectionCard>

      <SectionCard title="Recommendations">
        {latestRecommendations.length ? (
          latestRecommendations.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onPress={() => router.push(`/recipe/${recipe.id}`)} />
          ))
        ) : (
          <EmptyState title="No matches yet" body="Try wider filters or add more pantry ingredients." />
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#f4f7f1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  groupLabel: {
    color: "#395040",
    fontWeight: "700",
  },
  filterChip: {
    backgroundColor: "#eef3ec",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: "#153a2a",
  },
  filterLabel: {
    color: "#254232",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  filterLabelActive: {
    color: "#f8fbf8",
  },
  control: {
    backgroundColor: "#eef3ec",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  controlActive: {
    backgroundColor: "#153a2a",
  },
  controlText: {
    color: "#2b4335",
    fontWeight: "600",
    fontSize: 13,
  },
  controlTextActive: {
    color: "#f8fbf8",
  },
  button: {
    backgroundColor: "#153a2a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  memoryText: {
    color: "#59695e",
    lineHeight: 20,
  },
});
