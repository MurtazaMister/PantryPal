import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { quantityLabel } from "../../src/lib";
import { useAppStore } from "../../src/store/useAppStore";
import type { ItemSuggestion, Unit } from "../../src/types";

const BUILT_IN_UNITS: Unit[] = ["piece", "cup", "tbsp", "tsp", "gram", "kilogram", "ml", "liter", "bunch"];

export default function ShoppingScreen() {
  const shoppingItems = useAppStore((state) => state.shoppingItems);
  const customUnits = useAppStore((state) => state.customUnits);
  const suggestionResults = useAppStore((state) => state.suggestionResults);
  const addShoppingItem = useAppStore((state) => state.addShoppingItem);
  const updateShoppingItem = useAppStore((state) => state.updateShoppingItem);
  const deleteShoppingItem = useAppStore((state) => state.deleteShoppingItem);
  const markShoppingBought = useAppStore((state) => state.markShoppingBought);
  const fetchSuggestions = useAppStore((state) => state.fetchSuggestions);
  const clearSuggestions = useAppStore((state) => state.clearSuggestions);
  const saveCustomUnit = useAppStore((state) => state.saveCustomUnit);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedUnit, setSelectedUnit] = useState<Unit>("piece");
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const [customUnitDraft, setCustomUnitDraft] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editUnit, setEditUnit] = useState<Unit>("piece");
  const [editShowCustomUnit, setEditShowCustomUnit] = useState(false);
  const [editCustomUnitDraft, setEditCustomUnitDraft] = useState("");

  const allUnits = useMemo(() => [...BUILT_IN_UNITS, ...customUnits], [customUnits]);

  async function applySuggestion(suggestion: ItemSuggestion) {
    setName(suggestion.name);
    if (suggestion.unit) {
      setSelectedUnit(suggestion.unit);
      setShowCustomUnit(!BUILT_IN_UNITS.includes(suggestion.unit));
      setCustomUnitDraft(!BUILT_IN_UNITS.includes(suggestion.unit) ? suggestion.unit : "");
    }
    clearSuggestions();
  }

  function startEdit(id: string) {
    const item = shoppingItems.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    setEditingId(id);
    setEditName(item.name);
    setEditQuantity(String(item.quantity));
    setEditUnit(item.unit);
    const isCustom = !BUILT_IN_UNITS.includes(item.unit);
    setEditShowCustomUnit(isCustom);
    setEditCustomUnitDraft(isCustom ? item.unit : "");
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) {
      return;
    }
    let finalUnit = editUnit;
    if (editShowCustomUnit && editCustomUnitDraft.trim()) {
      finalUnit = editCustomUnitDraft.trim().toLowerCase();
      await saveCustomUnit(finalUnit);
    }
    updateShoppingItem(editingId, {
      name: editName.trim(),
      quantity: Number(editQuantity) || 1,
      unit: finalUnit,
    });
    setEditingId(null);
  }

  async function addItem() {
    const itemName = name.trim();
    if (!itemName) {
      return;
    }

    let finalUnit = selectedUnit;
    if (showCustomUnit && customUnitDraft.trim()) {
      finalUnit = customUnitDraft.trim().toLowerCase();
      await saveCustomUnit(finalUnit);
    }

    addShoppingItem({
      name: itemName,
      quantity: Number(quantity) || 1,
      unit: finalUnit,
    });

    setName("");
    setQuantity("1");
    setSelectedUnit("piece");
    setShowCustomUnit(false);
    setCustomUnitDraft("");
    clearSuggestions();
  }

  return (
    <Screen>
      <SectionCard title="Add grocery" subtitle="Suggestions help avoid duplicate names and messy inventory entries.">
        <TextInput
          style={styles.input}
          placeholder="Item name"
          value={name}
          onChangeText={async (value) => {
            setName(value);
            if (!value.trim()) {
              clearSuggestions();
              return;
            }
            await fetchSuggestions(value);
          }}
        />

        {suggestionResults.length ? (
          <View style={styles.suggestionsBox}>
            {suggestionResults.slice(0, 3).map((entry) => (
              <Pressable key={entry.normalizedName} style={styles.suggestionRow} onPress={() => applySuggestion(entry)}>
                <Text style={styles.suggestionTitle}>{entry.name}</Text>
                <Text style={styles.suggestionMeta}>{entry.unit ?? "piece"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Quantity"
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
        />

        <Text style={styles.label}>Unit</Text>
        <View style={styles.unitGrid}>
          {allUnits.map((unit) => (
            <Pressable
              key={unit}
              style={[styles.unitChip, selectedUnit === unit && styles.unitChipActive]}
              onPress={() => {
                setSelectedUnit(unit);
                setShowCustomUnit(!BUILT_IN_UNITS.includes(unit));
                if (BUILT_IN_UNITS.includes(unit)) {
                  setCustomUnitDraft("");
                }
              }}
            >
              <Text style={[styles.unitText, selectedUnit === unit && styles.unitTextActive]}>{unit}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.unitChip, showCustomUnit && styles.unitChipActive]}
            onPress={() => {
              setShowCustomUnit(true);
              setSelectedUnit(customUnitDraft.trim() || "custom");
            }}
          >
            <Text style={[styles.unitText, showCustomUnit && styles.unitTextActive]}>Custom...</Text>
          </Pressable>
        </View>

        {showCustomUnit ? (
          <TextInput
            style={styles.input}
            placeholder="Custom unit (for example: packet, loaf)"
            value={customUnitDraft}
            onChangeText={(value) => {
              setCustomUnitDraft(value);
              if (value.trim()) {
                setSelectedUnit(value.trim().toLowerCase());
              }
            }}
          />
        ) : null}

        <Pressable style={styles.button} onPress={addItem}>
          <Text style={styles.buttonText}>Add to shopping list</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="Shopping list" subtitle="Tap bought to move the item directly into pantry.">
        {shoppingItems.length ? (
          shoppingItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemMeta}>{quantityLabel(item.quantity, item.unit)}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable style={[styles.smallButton, styles.success]} onPress={() => void markShoppingBought(item.id)}>
                  <Text style={styles.smallButtonText}>Bought</Text>
                </Pressable>
                <Pressable style={[styles.smallButton, styles.edit]} onPress={() => startEdit(item.id)}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.smallButton, styles.ghost]} onPress={() => deleteShoppingItem(item.id)}>
                  <Text style={styles.ghostText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <EmptyState
            title="Nothing to buy"
            body="Add groceries or let missing recipe ingredients flow back into this list."
          />
        )}
      </SectionCard>

      <Modal transparent visible={Boolean(editingId)} animationType="fade" onRequestClose={() => setEditingId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit shopping item</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={editQuantity}
              onChangeText={setEditQuantity}
            />
            <View style={styles.unitGrid}>
              {allUnits.map((unit) => (
                <Pressable
                  key={`edit-unit-${unit}`}
                  style={[styles.unitChip, editUnit === unit && styles.unitChipActive]}
                  onPress={() => {
                    setEditUnit(unit);
                    setEditShowCustomUnit(!BUILT_IN_UNITS.includes(unit));
                    if (BUILT_IN_UNITS.includes(unit)) {
                      setEditCustomUnitDraft("");
                    }
                  }}
                >
                  <Text style={[styles.unitText, editUnit === unit && styles.unitTextActive]}>{unit}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.unitChip, editShowCustomUnit && styles.unitChipActive]}
                onPress={() => {
                  setEditShowCustomUnit(true);
                  setEditUnit(editCustomUnitDraft.trim() || "custom");
                }}
              >
                <Text style={[styles.unitText, editShowCustomUnit && styles.unitTextActive]}>Custom...</Text>
              </Pressable>
            </View>
            {editShowCustomUnit ? (
              <TextInput
                style={styles.input}
                placeholder="Custom unit"
                value={editCustomUnitDraft}
                onChangeText={(value) => {
                  setEditCustomUnitDraft(value);
                  if (value.trim()) {
                    setEditUnit(value.trim().toLowerCase());
                  }
                }}
              />
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={[styles.smallButton, styles.ghost]} onPress={() => setEditingId(null)}>
                <Text style={styles.ghostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.smallButton, styles.success]} onPress={() => void saveEdit()}>
                <Text style={styles.smallButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  suggestionsBox: {
    borderWidth: 1,
    borderColor: "#deeadf",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eff4ec",
  },
  suggestionTitle: {
    color: "#163627",
    fontWeight: "700",
  },
  suggestionMeta: {
    color: "#678071",
    marginTop: 2,
    fontSize: 12,
  },
  label: {
    color: "#44584a",
    fontWeight: "700",
  },
  unitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  unitChip: {
    backgroundColor: "#edf4ec",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  unitChipActive: {
    backgroundColor: "#153a2a",
  },
  unitText: {
    color: "#2b4637",
    fontWeight: "600",
  },
  unitTextActive: {
    color: "#f5faf6",
  },
  button: {
    backgroundColor: "#153a2a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#f8fbf8",
    fontWeight: "700",
    fontSize: 15,
  },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6ece2",
    padding: 14,
    gap: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#193126",
  },
  itemMeta: {
    marginTop: 4,
    color: "#66756a",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  smallButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  success: {
    backgroundColor: "#dcfce7",
  },
  edit: {
    backgroundColor: "#dbeafe",
  },
  ghost: {
    backgroundColor: "#f1f5f9",
  },
  smallButtonText: {
    color: "#166534",
    fontWeight: "700",
  },
  editText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  ghostText: {
    color: "#475569",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    color: "#163627",
    fontSize: 17,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
});
