import { StyleSheet, Text, View } from "react-native";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#eef5ef",
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#173225",
  },
  body: {
    color: "#55655a",
    lineHeight: 20,
  },
});
