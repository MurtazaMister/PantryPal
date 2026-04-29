import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { PantryItemCard } from "../../src/components/PantryItemCard";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { dateOnlyToIso, toIsoDateOnly } from "../../src/lib";
import { useAppStore } from "../../src/store/useAppStore";
import type { Unit } from "../../src/types";

const UNIT_OPTIONS: Unit[] = ["piece", "cup", "tbsp", "tsp", "gram", "kilogram", "ml", "liter", "bunch"];

export default function PantryScreen() {
  const pantryItems = useAppStore((state) => state.pantryItems);
  const customUnits = useAppStore((state) => state.customUnits);
  const saveCustomUnit = useAppStore((state) => state.saveCustomUnit);
  const updatePantryItem = useAppStore((state) => state.updatePantryItem);
  const deletePantryItem = useAppStore((state) => state.deletePantryItem);

  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editUnit, setEditUnit] = useState<Unit>("piece");
  const [editShowCustomUnit, setEditShowCustomUnit] = useState(false);
  const [editCustomUnitDraft, setEditCustomUnitDraft] = useState("");
  const [editPurchasedDate, setEditPurchasedDate] = useState(toIsoDateOnly(new Date()));
  const [editExpiry, setEditExpiry] = useState(toIsoDateOnly(new Date()));
  const [editApproxExpiry, setEditApproxExpiry] = useState<string | undefined>(undefined);
  const [showPurchasedPicker, setShowPurchasedPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  const allUnits = useMemo(() => [...UNIT_OPTIONS, ...customUnits], [customUnits]);
  const filtered = useMemo(
    () =>
      pantryItems
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        .sort((left, right) => (left.expiryDate ?? "9999").localeCompare(right.expiryDate ?? "9999")),
    [pantryItems, query],
  );

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
    setEditExpiry(item.expiryDate ? toIsoDateOnly(item.expiryDate) : toIsoDateOnly(new Date()));
    setEditApproxExpiry(item.approxExpiryDate ? toIsoDateOnly(item.approxExpiryDate) : undefined);
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

    await updatePantryItem(editingId, {
      name: editName.trim(),
      quantity: Number(editQuantity) || 1,
      unit: finalUnit,
      purchasedDate: dateOnlyToIso(editPurchasedDate),
      expiryDate: dateOnlyToIso(editExpiry),
    });
    setEditingId(null);
  }

  return (
    <Screen>
      <SectionCard title="Pantry inventory" subtitle="Each purchase stays separate by bought date.">
        <TextInput style={styles.input} placeholder="Search pantry" value={query} onChangeText={setQuery} />
      </SectionCard>

      <SectionCard title="All items">
        {filtered.length ? (
          filtered.map((item) => (
            <PantryItemCard
              key={item.id}
              item={item}
              onEdit={() => startEdit(item.id)}
              onDelete={() => deletePantryItem(item.id)}
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
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>Bought</Text>
                <Text style={styles.badgeValue}>{editPurchasedDate}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>Approx expiry</Text>
                <Text style={styles.badgeValue}>{editApproxExpiry ?? "-"}</Text>
              </View>
            </View>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={editQuantity}
              onChangeText={setEditQuantity}
            />
            <Text style={styles.label}>Unit</Text>
            <View style={styles.pillRow}>
              {allUnits.map((unit) => (
                <Pressable
                  key={unit}
                  style={[styles.pill, editUnit === unit && styles.pillActive]}
                  onPress={() => {
                    setEditUnit(unit);
                    setEditShowCustomUnit(!UNIT_OPTIONS.includes(unit));
                    if (UNIT_OPTIONS.includes(unit)) {
                      setEditCustomUnitDraft("");
                    }
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
                  if (value.trim()) {
                    setEditUnit(value.trim().toLowerCase());
                  }
                }}
              />
            ) : null}

            <View style={styles.dateRow}>
              <Pressable style={styles.dateButton} onPress={() => setShowPurchasedPicker(true)}>
                <Text style={styles.dateLabel}>Bought date</Text>
                <Text style={styles.dateValue}>{editPurchasedDate}</Text>
              </Pressable>
              <Pressable style={styles.dateButton} onPress={() => setShowExpiryPicker(true)}>
                <Text style={styles.dateLabel}>Expiry date</Text>
                <Text style={styles.dateValue}>{editExpiry}</Text>
              </Pressable>
            </View>

            {showPurchasedPicker ? (
              <DateTimePicker
                value={new Date(editPurchasedDate)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event, selected) => {
                  if (Platform.OS !== "ios") {
                    setShowPurchasedPicker(false);
                  }
                  if (selected) {
                    setEditPurchasedDate(toIsoDateOnly(selected));
                  }
                }}
              />
            ) : null}
            {showExpiryPicker ? (
              <DateTimePicker
                value={new Date(editExpiry)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event, selected) => {
                  if (Platform.OS !== "ios") {
                    setShowExpiryPicker(false);
                  }
                  if (selected) {
                    setEditExpiry(toIsoDateOnly(selected));
                  }
                }}
              />
            ) : null}

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
  },
  modalTitle: {
    color: "#163627",
    fontSize: 17,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    flex: 1,
    backgroundColor: "#eef4ec",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badgeLabel: {
    color: "#63796a",
    fontSize: 11,
    fontWeight: "600",
  },
  badgeValue: {
    marginTop: 2,
    color: "#1c372a",
    fontSize: 13,
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
});
