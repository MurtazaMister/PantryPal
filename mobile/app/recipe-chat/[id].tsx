import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { useAppStore } from "../../src/store/useAppStore";

export default function RecipeChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAppStore((state) => state.recipeChatSession);
  const startRecipeChat = useAppStore((state) => state.startRecipeChat);
  const endRecipeChat = useAppStore((state) => state.endRecipeChat);
  const sendRecipeChatMessage = useAppStore((state) => state.sendRecipeChatMessage);
  const finalizeRecipeFromChat = useAppStore((state) => state.finalizeRecipeFromChat);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (id) {
      startRecipeChat(id);
    }
    return () => {
      endRecipeChat();
    };
  }, [id, startRecipeChat, endRecipeChat]);

  const snapshot = session?.recipeSnapshot;

  const canCook = useMemo(() => Boolean(session && snapshot), [session, snapshot]);

  async function onCooked() {
    const draftId = await finalizeRecipeFromChat();
    if (draftId) {
      router.push(`/deduction-review/${draftId}`);
    }
  }

  if (!session || !snapshot) {
    return (
      <Screen>
        <SectionCard title="Recipe chat unavailable">
          <Text>Unable to open recipe chat for this item.</Text>
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.title}>{snapshot.title}</Text>
        <Pressable style={styles.cookedButton} onPress={() => void onCooked()} disabled={!canCook}>
          <Text style={styles.cookedText}>I've cooked this</Text>
        </Pressable>
      </View>

      <SectionCard title="Current recipe snapshot" subtitle={`${snapshot.cuisine} • ${snapshot.cookingTimeMinutes} min • ${snapshot.servings} servings`}>
        <Text style={styles.meta}>Equipment: {snapshot.equipment.join(", ")}</Text>
      </SectionCard>

      <SectionCard title="Recipe chat">
        <ScrollView style={styles.chatArea} contentContainerStyle={styles.chatContent}>
          {session.messages.map((msg, index) => (
            <View key={`${msg.createdAt}-${index}`} style={[styles.msg, msg.role === "user" ? styles.userMsg : styles.aiMsg]}>
              <Text style={styles.msgRole}>{msg.role === "user" ? "You" : "AI"}</Text>
              <Text style={styles.msgText}>{msg.text}</Text>
            </View>
          ))}
          {session.loading ? <Text style={styles.loading}>AI is updating the recipe...</Text> : null}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask to modify this recipe..."
            value={input}
            onChangeText={setInput}
          />
          <Pressable
            style={styles.send}
            onPress={() => {
              const next = input.trim();
              if (!next) return;
              setInput("");
              void sendRecipeChatMessage(next);
            }}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#163627",
    flex: 1,
  },
  cookedButton: {
    backgroundColor: "#153a2a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cookedText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  meta: {
    color: "#5b6c61",
  },
  chatArea: {
    maxHeight: 330,
  },
  chatContent: {
    gap: 8,
  },
  msg: {
    borderRadius: 12,
    padding: 10,
  },
  userMsg: {
    backgroundColor: "#e6f3ea",
  },
  aiMsg: {
    backgroundColor: "#f3f6f2",
  },
  msgRole: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2b4437",
    marginBottom: 2,
  },
  msgText: {
    color: "#304539",
    lineHeight: 20,
  },
  loading: {
    color: "#6b7c72",
    fontSize: 12,
  },
  inputRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#f4f7f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  send: {
    backgroundColor: "#153a2a",
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  sendText: {
    color: "#fff",
    fontWeight: "700",
  },
});
