import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { RecipeCard } from "../../src/components/RecipeCard";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { useAppStore } from "../../src/store/useAppStore";
import type { MealType, RecommendationFilters } from "../../src/types";

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

type CookUiFilters = {
  mealType?: MealType;
  maxMinutes?: 15 | 30 | 60;
  availability?: RecommendationFilters["availability"];
};

export default function CookScreen() {
  const setSelectedMealType = useAppStore((state) => state.setSelectedMealType);
  const generateRecommendations = useAppStore((state) => state.generateRecommendations);
  const latestRecommendations = useAppStore((state) => state.latestRecommendations);
  const memorySummary = useAppStore((state) => state.memorySummary);

  const [prompt, setPrompt] = useState("");
  const [filters, setFilters] = useState<CookUiFilters>({});

  const hasAnyFilters = useMemo(
    () => Boolean(filters.mealType || filters.maxMinutes || filters.availability),
    [filters],
  );

  function applyFilters(next: CookUiFilters) {
    setFilters(next);
  }

  function toggleMealType(mealType: MealType) {
    applyFilters({
      ...filters,
      mealType: filters.mealType === mealType ? undefined : mealType,
    });
  }

  function toggleTime(value: 15 | 30 | 60) {
    applyFilters({
      ...filters,
      maxMinutes: filters.maxMinutes === value ? undefined : value,
    });
  }

  function toggleAvailability(value: RecommendationFilters["availability"]) {
    applyFilters({
      ...filters,
      availability: filters.availability === value ? undefined : value,
    });
  }

  function runGenerate() {
    const mealType = filters.mealType ?? "dinner";
    setSelectedMealType(mealType);
    generateRecommendations(
      {
        mealType,
        availability: filters.availability ?? "prioritize-expiring",
        maxMinutes: filters.maxMinutes,
      },
      prompt,
    );
  }

  return (
    <Screen>
      <SectionCard
        title="Cook from your pantry"
        subtitle="No defaults selected. Tap again on any selected filter to clear it."
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
              style={[styles.filterChip, filters.mealType === mealType && styles.filterChipActive]}
              onPress={() => toggleMealType(mealType)}
            >
              <Text style={[styles.filterLabel, filters.mealType === mealType && styles.filterLabelActive]}>
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
              style={[styles.control, filters.maxMinutes === entry.value && styles.controlActive]}
              onPress={() => toggleTime(entry.value)}
            >
              <Text style={[styles.controlText, filters.maxMinutes === entry.value && styles.controlTextActive]}>
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
              style={[styles.control, filters.availability === entry.value && styles.controlActive]}
              onPress={() => toggleAvailability(entry.value)}
            >
              <Text style={[styles.controlText, filters.availability === entry.value && styles.controlTextActive]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.button} onPress={runGenerate}>
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
          <EmptyState
            title={hasAnyFilters ? "No matches yet" : "Choose filters and generate"}
            body={hasAnyFilters ? "Try wider filters or add more pantry ingredients." : "Pick optional filters, then tap Generate recipes."}
          />
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
