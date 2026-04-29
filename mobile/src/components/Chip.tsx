import { StyleSheet, Text, View } from "react-native";

export function Chip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <View
      style={[
        styles.chip,
        tone === "success" && styles.success,
        tone === "warning" && styles.warning,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#edf2ea",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  success: {
    backgroundColor: "#dcfce7",
  },
  warning: {
    backgroundColor: "#fef3c7",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#23412f",
  },
});
