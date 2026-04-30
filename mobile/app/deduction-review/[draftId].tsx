import { useLocalSearchParams, router } from "expo-router";
import { useMemo, useState } from "react";
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
  const pantryItems = useAppStore((state) => state.pantryItems);
  const draft = useMemo(() => drafts.find((entry) => entry.id === draftId), [drafts, draftId]);
  const [selectedPantryItemId, setSelectedPantryItemId] = useState<string | null>(null);
  const [addQty, setAddQty] = useState("1");
  const [addError, setAddError] = useState<string | null>(null);

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
            <Pressable
              style={styles.removeButton}
              onPress={() => {
                const next = {
                  ...draft,
                  deductions: draft.deductions.filter((_, deductionIndex) => deductionIndex !== index),
                };
                updateDraft(draft.id, next);
              }}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.addSection}>
          <Text style={styles.section}>Add pantry ingredient</Text>
          <View style={styles.pantryPicker}>
            {pantryItems.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.pantryChip, selectedPantryItemId === item.id && styles.pantryChipActive]}
                onPress={() => {
                  setSelectedPantryItemId(item.id);
                  setAddError(null);
                }}
              >
                <Text style={[styles.pantryChipText, selectedPantryItemId === item.id && styles.pantryChipTextActive]}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput style={styles.input} value={addQty} onChangeText={setAddQty} keyboardType="decimal-pad" />
            <Pressable
              style={styles.addButton}
              onPress={() => {
                const pantryItem = pantryItems.find((item) => item.id === selectedPantryItemId);
                if (!pantryItem) {
                  setAddError("Select an ingredient from pantry.");
                  return;
                }
                const nextQty = Number(addQty) || 0;
                if (nextQty <= 0) {
                  setAddError("Quantity must be greater than 0.");
                  return;
                }
                const next = {
                  ...draft,
                  deductions: [
                    ...draft.deductions,
                    {
                      pantryItemId: pantryItem.id,
                      pantryItemName: pantryItem.name,
                      quantity: nextQty,
                      unit: pantryItem.unit,
                      confidence: 0.7,
                      reason: "Added manually from pantry.",
                    },
                  ],
                };
                updateDraft(draft.id, next);
                setAddError(null);
              }}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
          {addError ? <Text style={styles.error}>{addError}</Text> : null}
        </View>
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
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  removeText: {
    color: "#991b1b",
    fontWeight: "700",
    fontSize: 12,
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
  addSection: {
    marginTop: 10,
    gap: 8,
  },
  pantryPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pantryChip: {
    backgroundColor: "#edf4ec",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pantryChipActive: {
    backgroundColor: "#153a2a",
  },
  pantryChipText: {
    color: "#234233",
    fontSize: 12,
    fontWeight: "600",
  },
  pantryChipTextActive: {
    color: "#fff",
  },
  addRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addButtonText: {
    color: "#166534",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    fontSize: 12,
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
