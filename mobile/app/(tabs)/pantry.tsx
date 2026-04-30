import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { PantryItemCard } from "../../src/components/PantryItemCard";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { dateOnlyToIso, dateOnlyToLocalDate, toIsoDateOnly } from "../../src/lib";
import { useAppStore } from "../../src/store/useAppStore";
import type { ItemSuggestion, Unit } from "../../src/types";

const UNIT_OPTIONS: Unit[] = ["piece", "cup", "tbsp", "tsp", "gram", "kilogram", "ml", "liter", "bunch"];

export default function PantryScreen() {
  const pantryItems = useAppStore((state) => state.pantryItems);
  const customUnits = useAppStore((state) => state.customUnits);
  const suggestionResults = useAppStore((state) => state.suggestionResults);
  const saveCustomUnit = useAppStore((state) => state.saveCustomUnit);
  const updatePantryItem = useAppStore((state) => state.updatePantryItem);
  const deletePantryItem = useAppStore((state) => state.deletePantryItem);
  const addPantryItem = useAppStore((state) => state.addPantryItem);
  const fetchSuggestions = useAppStore((state) => state.fetchSuggestions);
  const clearSuggestions = useAppStore((state) => state.clearSuggestions);
  const deleteSuggestionHistoryItem = useAppStore((state) => state.deleteSuggestionHistoryItem);

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editUnit, setEditUnit] = useState<Unit>("piece");
  const [editShowCustomUnit, setEditShowCustomUnit] = useState(false);
  const [editCustomUnitDraft, setEditCustomUnitDraft] = useState("");
  const [editPurchasedDate, setEditPurchasedDate] = useState(toIsoDateOnly(new Date()));
  const [editExpiry, setEditExpiry] = useState(toIsoDateOnly(new Date()));
  const [activeDateField, setActiveDateField] = useState<"purchased" | "expiry" | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const [addName, setAddName] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [addUnit, setAddUnit] = useState<Unit>("piece");
  const [addShowCustomUnit, setAddShowCustomUnit] = useState(false);
  const [addCustomUnitDraft, setAddCustomUnitDraft] = useState("");
  const [addBoughtDate, setAddBoughtDate] = useState(toIsoDateOnly(new Date()));
  const [addExpiryDate, setAddExpiryDate] = useState("");
  const [addActiveDateField, setAddActiveDateField] = useState<"purchased" | "expiry" | null>(null);

  const allUnits = useMemo(() => [...UNIT_OPTIONS, ...customUnits], [customUnits]);
  const filtered = useMemo(
    () =>
      pantryItems
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        .sort((left, right) => (left.expiryDate ?? "9999").localeCompare(right.expiryDate ?? "9999")),
    [pantryItems, query],
  );

  function validateDates(bought: string, expiry: string) {
    if (!expiry.trim()) {
      return true;
    }
    return new Date(dateOnlyToIso(bought)).getTime() <= new Date(dateOnlyToIso(expiry)).getTime();
  }

  function startEdit(id: string) {
    const item = pantryItems.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    setEditingId(id);
    setEditName(item.name);
    setEditQuantity(String(item.quantity));
    setEditUnit(item.unit);
    const isCustom = !UNIT_OPTIONS.includes(item.unit);
    setEditShowCustomUnit(isCustom);
    setEditCustomUnitDraft(isCustom ? item.unit : "");
    setEditPurchasedDate(toIsoDateOnly(item.purchasedDate));
    setEditExpiry(item.expiryDate ? toIsoDateOnly(item.expiryDate) : item.approxExpiryDate ? toIsoDateOnly(item.approxExpiryDate) : "");
    setActiveDateField(null);
    setDateError(null);
  }

  async function applySuggestionToAdd(suggestion: ItemSuggestion) {
    setAddName(suggestion.name);
    if (suggestion.unit) {
      setAddUnit(suggestion.unit);
      setAddShowCustomUnit(!UNIT_OPTIONS.includes(suggestion.unit));
      setAddCustomUnitDraft(!UNIT_OPTIONS.includes(suggestion.unit) ? suggestion.unit : "");
    }
    clearSuggestions();
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) {
      return;
    }
    if (!validateDates(editPurchasedDate, editExpiry)) {
      setDateError("Bought date must be on or before expiry date.");
      return;
    }
    setDateError(null);

    let finalUnit = editUnit;
    if (editShowCustomUnit && editCustomUnitDraft.trim()) {
      finalUnit = editCustomUnitDraft.trim().toLowerCase();
      await saveCustomUnit(finalUnit);
    }

    await updatePantryItem(editingId, {
      name: editName.trim(),
      quantity: Number(editQuantity) || 1,
      unit: finalUnit,
      purchasedDate: dateOnlyToIso(editPurchasedDate),
      expiryDate: editExpiry.trim() ? dateOnlyToIso(editExpiry) : undefined,
    });
    setEditingId(null);
  }

  async function saveAdd() {
    if (!addName.trim()) {
      return;
    }
    if (!validateDates(addBoughtDate, addExpiryDate)) {
      Alert.alert("Invalid dates", "Bought date must be on or before expiry date.");
      return;
    }
    let finalUnit = addUnit;
    if (addShowCustomUnit && addCustomUnitDraft.trim()) {
      finalUnit = addCustomUnitDraft.trim().toLowerCase();
      await saveCustomUnit(finalUnit);
    }
    await addPantryItem({
      name: addName.trim(),
      quantity: Number(addQuantity) || 1,
      unit: finalUnit,
      purchasedDate: dateOnlyToIso(addBoughtDate),
      expiryDate: addExpiryDate.trim() ? dateOnlyToIso(addExpiryDate) : undefined,
    });
    setAddingOpen(false);
    setAddName("");
    setAddQuantity("1");
    setAddUnit("piece");
    setAddShowCustomUnit(false);
    setAddCustomUnitDraft("");
    setAddBoughtDate(toIsoDateOnly(new Date()));
    setAddExpiryDate("");
    setAddActiveDateField(null);
    clearSuggestions();
  }

  return (
    <Screen>
      <SectionCard title="Pantry inventory" subtitle="Track bought and expiry dates per item.">
        <View style={styles.searchWrap}>
          <TextInput style={styles.searchInput} placeholder="Search pantry" value={query} onChangeText={setQuery} />
          {query.trim().length ? (
            <Pressable style={styles.searchClear} onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close" size={16} color="#64748b" />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.addButton} onPress={() => setAddingOpen(true)}>
          <Text style={styles.addButtonText}>Add item</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="All items">
        {filtered.length ? (
          filtered.map((item) => (
            <PantryItemCard
              key={item.id}
              item={item}
              onEdit={() => startEdit(item.id)}
              onDelete={() =>
                Alert.alert("Delete item", `Delete "${item.name}" from your pantry?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deletePantryItem(item.id) },
                ])
              }
            />
          ))
        ) : (
          <EmptyState
            title="Pantry is empty"
            body="Mark a shopping item as bought or add pantry items manually to get recommendations."
          />
        )}
      </SectionCard>

      <Modal transparent visible={Boolean(editingId)} animationType="fade" onRequestClose={() => setEditingId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit pantry item</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            <TextInput style={styles.input} keyboardType="decimal-pad" value={editQuantity} onChangeText={setEditQuantity} />

            <Text style={styles.label}>Unit</Text>
            <View style={styles.pillRow}>
              {allUnits.map((unit) => (
                <Pressable
                  key={unit}
                  style={[styles.pill, editUnit === unit && styles.pillActive]}
                  onPress={() => {
                    setEditUnit(unit);
                    setEditShowCustomUnit(!UNIT_OPTIONS.includes(unit));
                    if (UNIT_OPTIONS.includes(unit)) setEditCustomUnitDraft("");
                  }}
                >
                  <Text style={[styles.pillText, editUnit === unit && styles.pillTextActive]}>{unit}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.pill, editShowCustomUnit && styles.pillActive]}
                onPress={() => {
                  setEditShowCustomUnit(true);
                  setEditUnit(editCustomUnitDraft.trim() || "custom");
                }}
              >
                <Text style={[styles.pillText, editShowCustomUnit && styles.pillTextActive]}>Custom...</Text>
              </Pressable>
            </View>
            {editShowCustomUnit ? (
              <TextInput
                style={styles.input}
                placeholder="Custom unit"
                value={editCustomUnitDraft}
                onChangeText={(value) => {
                  setEditCustomUnitDraft(value);
                  if (value.trim()) setEditUnit(value.trim().toLowerCase());
                }}
              />
            ) : null}

            <View style={styles.dateRow}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setActiveDateField((prev) => (prev === "purchased" ? null : "purchased"))}
              >
                <Text style={styles.dateLabel}>Bought date</Text>
                <Text style={styles.dateValue}>{editPurchasedDate}</Text>
              </Pressable>
              <Pressable
                style={styles.dateButton}
                onPress={() => setActiveDateField((prev) => (prev === "expiry" ? null : "expiry"))}
              >
                <Text style={styles.dateLabel}>Expiry date</Text>
                <Text style={styles.dateValue}>{editExpiry || "Select date"}</Text>
              </Pressable>
            </View>

            {activeDateField ? (
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={dateOnlyToLocalDate(activeDateField === "purchased" ? editPurchasedDate : (editExpiry || editPurchasedDate))}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  textColor="#1f2937"
                  themeVariant="light"
                  onChange={(_event, selected) => {
                    if (Platform.OS !== "ios") setActiveDateField(null);
                    if (!selected) return;
                    if (activeDateField === "purchased") {
                      const next = toIsoDateOnly(selected);
                      setEditPurchasedDate(next);
                      if (editExpiry && !validateDates(next, editExpiry)) {
                        setEditExpiry(next);
                      }
                    } else {
                      setEditExpiry(toIsoDateOnly(selected));
                    }
                  }}
                />
              </View>
            ) : null}
            {dateError ? <Text style={styles.errorText}>{dateError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={[styles.actionButton, styles.cancel]} onPress={() => setEditingId(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.save]} onPress={() => void saveEdit()}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={addingOpen} animationType="fade" onRequestClose={() => setAddingOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add pantry item</Text>
            <TextInput
              style={styles.input}
              placeholder="Item name"
              value={addName}
              onChangeText={async (value) => {
                setAddName(value);
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
                  <View key={`add-${entry.normalizedName}`} style={styles.suggestionRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => applySuggestionToAdd(entry)}>
                      <Text style={styles.suggestionTitle}>{entry.name}</Text>
                      <Text style={styles.suggestionMeta}>{entry.unit ?? "piece"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteSuggestion}
                      onPress={async () => {
                        const result = await deleteSuggestionHistoryItem(entry.normalizedName);
                        if (!result.ok && result.blocked) {
                          Alert.alert("Cannot delete", result.reason ?? "Item is present and cannot be deleted.");
                        }
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Quantity"
              keyboardType="decimal-pad"
              value={addQuantity}
              onChangeText={setAddQuantity}
            />
            <Text style={styles.label}>Unit</Text>
            <View style={styles.pillRow}>
              {allUnits.map((unit) => (
                <Pressable
                  key={`add-unit-${unit}`}
                  style={[styles.pill, addUnit === unit && styles.pillActive]}
                  onPress={() => {
                    setAddUnit(unit);
                    setAddShowCustomUnit(!UNIT_OPTIONS.includes(unit));
                    if (UNIT_OPTIONS.includes(unit)) setAddCustomUnitDraft("");
                  }}
                >
                  <Text style={[styles.pillText, addUnit === unit && styles.pillTextActive]}>{unit}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.pill, addShowCustomUnit && styles.pillActive]}
                onPress={() => {
                  setAddShowCustomUnit(true);
                  setAddUnit(addCustomUnitDraft.trim() || "custom");
                }}
              >
                <Text style={[styles.pillText, addShowCustomUnit && styles.pillTextActive]}>Custom...</Text>
              </Pressable>
            </View>
            {addShowCustomUnit ? (
              <TextInput
                style={styles.input}
                placeholder="Custom unit"
                value={addCustomUnitDraft}
                onChangeText={(value) => {
                  setAddCustomUnitDraft(value);
                  if (value.trim()) setAddUnit(value.trim().toLowerCase());
                }}
              />
            ) : null}

            <View style={styles.dateRow}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setAddActiveDateField((prev) => (prev === "purchased" ? null : "purchased"))}
              >
                <Text style={styles.dateLabel}>Bought date</Text>
                <Text style={styles.dateValue}>{addBoughtDate}</Text>
              </Pressable>
              <Pressable
                style={styles.dateButton}
                onPress={() => setAddActiveDateField((prev) => (prev === "expiry" ? null : "expiry"))}
              >
                <Text style={styles.dateLabel}>Expiry date (optional)</Text>
                <Text style={styles.dateValue}>{addExpiryDate || "AI will estimate"}</Text>
              </Pressable>
            </View>

            {addActiveDateField ? (
              <View style={styles.pickerCard}>
                <DateTimePicker
                  value={dateOnlyToLocalDate(addActiveDateField === "purchased" ? addBoughtDate : (addExpiryDate || addBoughtDate))}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  textColor="#1f2937"
                  themeVariant="light"
                  onChange={(_event, selected) => {
                    if (Platform.OS !== "ios") setAddActiveDateField(null);
                    if (!selected) return;
                    if (addActiveDateField === "purchased") {
                      const next = toIsoDateOnly(selected);
                      setAddBoughtDate(next);
                      if (addExpiryDate && !validateDates(next, addExpiryDate)) {
                        setAddExpiryDate(next);
                      }
                    } else {
                      setAddExpiryDate(toIsoDateOnly(selected));
                    }
                  }}
                />
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={[styles.actionButton, styles.cancel]} onPress={() => setAddingOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.save]} onPress={() => void saveAdd()}>
                <Text style={styles.saveText}>Add item</Text>
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
  searchWrap: {
    position: "relative",
  },
  searchInput: {
    backgroundColor: "#f4f7f1",
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 40,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchClear: {
    position: "absolute",
    right: 10,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    backgroundColor: "#153a2a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    maxHeight: "90%",
  },
  modalTitle: {
    color: "#163627",
    fontSize: 17,
    fontWeight: "700",
  },
  label: {
    color: "#44584a",
    fontWeight: "700",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    backgroundColor: "#edf4ec",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: "#153a2a",
  },
  pillText: {
    color: "#2b4637",
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#f5faf6",
  },
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d6e3d7",
    backgroundColor: "#f9fcf8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateLabel: {
    color: "#5c7062",
    fontSize: 12,
    fontWeight: "600",
  },
  dateValue: {
    marginTop: 2,
    color: "#173225",
    fontWeight: "700",
  },
  pickerCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#deeadf",
    borderRadius: 12,
    minHeight: 280,
    overflow: "hidden",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancel: {
    backgroundColor: "#f1f5f9",
  },
  save: {
    backgroundColor: "#dcfce7",
  },
  cancelText: {
    color: "#475569",
    fontWeight: "700",
  },
  saveText: {
    color: "#166534",
    fontWeight: "700",
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: "#deeadf",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
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
  deleteSuggestion: {
    padding: 6,
    marginLeft: 8,
  },
});
