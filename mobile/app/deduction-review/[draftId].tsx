import { useLocalSearchParams, router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { trimNumber } from "../../src/lib";
import { useAppStore } from "../../src/store/useAppStore";

export default function DeductionReviewScreen() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const drafts = useAppStore((state) => state.deductionDrafts);
  const updateDraft = useAppStore((state) => state.updateDeductionDraft);
  const applyDraft = useAppStore((state) => state.applyDeductionDraft);
  const draft = useMemo(() => drafts.find((entry) => entry.id === draftId), [drafts, draftId]);

  if (!draft) {
    return (
      <Screen>
        <SectionCard title="Draft unavailable">
          <Text>The deduction draft could not be found.</Text>
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionCard title={draft.mealName} subtitle={`Review the AI estimate before inventory changes.`}>
        <Text style={styles.meta}>
          {draft.servings} servings • {draft.sourceType === "recipe" ? "From selected recipe" : "From meal description"}
        </Text>
        {draft.deductions.map((deduction, index) => (
          <View key={`${draft.id}-${index}`} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.item}>{deduction.pantryItemName}</Text>
              <Text style={styles.reason}>{deduction.reason}</Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={trimNumber(deduction.quantity)}
              onChangeText={(value) => {
                const next = {
                  ...draft,
                  deductions: draft.deductions.map((entry, deductionIndex) =>
                    deductionIndex === index ? { ...entry, quantity: Number(value) || 0 } : entry,
                  ),
                };
                updateDraft(draft.id, next);
              }}
            />
          </View>
        ))}
        {draft.unmatchedIngredients.length ? (
          <View style={styles.unmatched}>
            <Text style={styles.section}>Unmatched ingredients</Text>
            {draft.unmatchedIngredients.map((ingredient) => (
              <Text key={ingredient.name} style={styles.reason}>
                {ingredient.name}: {ingredient.reason}
              </Text>
            ))}
          </View>
        ) : null}
      </SectionCard>

      <Pressable
        style={styles.button}
        onPress={() => {
          applyDraft(draft.id);
          router.replace("/(tabs)/home");
        }}
      >
        <Text style={styles.buttonText}>Confirm and update pantry</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    color: "#58685e",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  item: {
    fontSize: 16,
    fontWeight: "700",
    color: "#193126",
  },
  reason: {
    color: "#64756a",
    lineHeight: 19,
  },
  input: {
    width: 72,
    backgroundColor: "#f4f7f1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  unmatched: {
    marginTop: 10,
    gap: 4,
  },
  section: {
    fontWeight: "700",
    color: "#193126",
  },
  button: {
    backgroundColor: "#153a2a",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
