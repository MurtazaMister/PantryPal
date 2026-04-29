import { Pressable, StyleSheet, Text, View } from "react-native";
import { daysUntil, quantityLabel, toIsoDateOnly } from "../lib";
import type { PantryItem } from "../types";
import { Chip } from "./Chip";

export function PantryItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: PantryItem;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const expiryDays = daysUntil(item.expiryDate);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.meta}>{quantityLabel(item.quantity, item.unit)}</Text>
          <Text style={styles.subMeta}>Bought: {toIsoDateOnly(item.purchasedDate)}</Text>
          <Text style={styles.subMeta}>Expiry: {item.expiryDate ? toIsoDateOnly(item.expiryDate) : "Not set"}</Text>
        </View>
        <View style={styles.actionColumn}>
          {onEdit ? (
            <Pressable onPress={onEdit}>
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.tags}>
        {item.isLowStock ? <Chip label="Low stock" tone="warning" /> : null}
        {expiryDays !== null && expiryDays < 0 ? <Chip label="Expired" tone="warning" /> : null}
        {expiryDays !== null && expiryDays >= 0 && expiryDays <= 3 ? (
          <Chip label={`Use in ${expiryDays}d`} tone="warning" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e6ece2",
  },
  header: {
    flexDirection: "row",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#132b20",
  },
  meta: {
    marginTop: 3,
    fontSize: 13,
    color: "#68756c",
  },
  subMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#7d8c82",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionColumn: {
    gap: 8,
    alignItems: "flex-end",
  },
  edit: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  delete: {
    color: "#9a3412",
    fontWeight: "700",
  },
});
