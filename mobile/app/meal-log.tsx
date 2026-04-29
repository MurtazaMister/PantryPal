import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { Screen } from "../src/components/Screen";
import { SectionCard } from "../src/components/SectionCard";
import { useAppStore } from "../src/store/useAppStore";

export default function MealLogScreen() {
  const createManualDraft = useAppStore((state) => state.createManualDraft);
  const selectedMealType = useAppStore((state) => state.selectedMealType);
  const [description, setDescription] = useState("I made dal rice for 3 people");
  const [servings, setServings] = useState("3");

  return (
    <Screen>
      <SectionCard title="Log a cooked meal" subtitle="Natural language in, editable pantry deductions out.">
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={servings}
          onChangeText={setServings}
        />
        <Pressable
          style={styles.button}
          onPress={() => {
            const draftId = createManualDraft(description, Number(servings) || 1, selectedMealType);
            router.push(`/deduction-review/${draftId}`);
          }}
        >
          <Text style={styles.buttonText}>Generate deduction draft</Text>
        </Pressable>
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
  multiline: {
    minHeight: 120,
    textAlignVertical: "top",
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
});
