import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { BACKEND_URL } from "../../src/services/backend";
import { scheduleMealReminders } from "../../src/services/reminders";
import { useAppStore } from "../../src/store/useAppStore";

export default function ProfileScreen() {
  const session = useAppStore((state) => state.session);
  const reminderPreferences = useAppStore((state) => state.reminderPreferences);
  const updateReminderPreferences = useAppStore((state) => state.updateReminderPreferences);
  const memorySummary = useAppStore((state) => state.memorySummary);
  const upgradeWithGoogle = useAppStore((state) => state.upgradeWithGoogle);
  const backendHealth = useAppStore((state) => state.backendHealth);
  const lastEstimateDebug = useAppStore((state) => state.lastEstimateDebug);

  const [status, setStatus] = useState("Local reminders are not scheduled yet.");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  async function runUpgrade(mode: "merge" | "fresh") {
    setUpgrading(true);
    const result = await upgradeWithGoogle(mode);
    setUpgrading(false);
    setShowUpgradeModal(false);
    setStatus(result.message);
  }

  return (
    <Screen>
      <SectionCard title="Account">
        <Text style={styles.headline}>{session.name}</Text>
        <Text style={styles.body}>
          Mode: {session.mode === "guest" ? "Guest with merge-ready data" : "Authenticated"}
        </Text>
        {session.mode === "guest" ? (
          <Pressable style={styles.button} onPress={() => setShowUpgradeModal(true)}>
            <Text style={styles.buttonText}>Upgrade to Google sign-in</Text>
          </Pressable>
        ) : null}
      </SectionCard>

      <SectionCard title="Reminder windows" subtitle="Breakfast, lunch, dinner, then a post-meal logging nudge.">
        <View style={styles.row}>
          <Toggle
            label="Breakfast"
            active={reminderPreferences.breakfastEnabled}
            onPress={() =>
              updateReminderPreferences({
                breakfastEnabled: !reminderPreferences.breakfastEnabled,
              })
            }
          />
          <Toggle
            label="Lunch"
            active={reminderPreferences.lunchEnabled}
            onPress={() =>
              updateReminderPreferences({
                lunchEnabled: !reminderPreferences.lunchEnabled,
              })
            }
          />
          <Toggle
            label="Dinner"
            active={reminderPreferences.dinnerEnabled}
            onPress={() =>
              updateReminderPreferences({
                dinnerEnabled: !reminderPreferences.dinnerEnabled,
              })
            }
          />
        </View>
        <Pressable
          style={styles.button}
          onPress={async () => {
            const success = await scheduleMealReminders(reminderPreferences);
            setStatus(
              success
                ? "Meal reminders scheduled on this device."
                : "Notification permission is still required.",
            );
          }}
        >
          <Text style={styles.buttonText}>Schedule local reminders</Text>
        </Pressable>
        <Text style={styles.body}>{status}</Text>
      </SectionCard>

      <SectionCard title="Memory profile">
        <Text style={styles.body}>Top cuisines: {memorySummary.topCuisines.join(", ")}</Text>
        <Text style={styles.body}>Preferred ingredients: {memorySummary.preferredIngredients.join(", ")}</Text>
        <Text style={styles.body}>Recent cooked: {memorySummary.recentCookedRecipes.join(", ")}</Text>
        <Text style={styles.body}>Time preference: {memorySummary.preferredTimeRange}</Text>
      </SectionCard>

      <SectionCard title="Debug (temporary)">
        <Text style={styles.body}>Backend URL: {BACKEND_URL}</Text>
        <Text style={styles.body}>
          Health: {backendHealth.ok ? "connected" : "disconnected"}
          {backendHealth.checkedAt ? ` at ${backendHealth.checkedAt}` : ""}
        </Text>
        <Text style={styles.body}>Estimate source: {lastEstimateDebug?.source ?? "none"}</Text>
        <Text style={styles.body}>Request id: {lastEstimateDebug?.requestId ?? "n/a"}</Text>
        <Text style={styles.body}>Last estimate error: {lastEstimateDebug?.error ?? "none"}</Text>
      </SectionCard>

      <Modal animationType="fade" visible={showUpgradeModal} transparent onRequestClose={() => setShowUpgradeModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Upgrade account</Text>
            <Text style={styles.modalBody}>Do you want to merge this guest data into your Google account or start fresh?</Text>
            <Pressable style={styles.modalPrimary} disabled={upgrading} onPress={() => runUpgrade("merge")}>
              <Text style={styles.modalPrimaryText}>{upgrading ? "Signing in..." : "Merge guest data"}</Text>
            </Pressable>
            <Pressable style={styles.modalSecondary} disabled={upgrading} onPress={() => runUpgrade("fresh")}>
              <Text style={styles.modalSecondaryText}>Start fresh account</Text>
            </Pressable>
            <Pressable style={styles.modalCancel} disabled={upgrading} onPress={() => setShowUpgradeModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Toggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={onPress}>
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 24,
    fontWeight: "800",
    color: "#153325",
  },
  body: {
    color: "#59695e",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  toggle: {
    flex: 1,
    backgroundColor: "#edf3ec",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#153a2a",
  },
  toggleLabel: {
    color: "#1f4531",
    fontWeight: "700",
  },
  toggleLabelActive: {
    color: "#fff",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#123326",
  },
  modalBody: {
    color: "#51685b",
    lineHeight: 20,
  },
  modalPrimary: {
    borderRadius: 12,
    backgroundColor: "#153a2a",
    paddingVertical: 12,
    alignItems: "center",
  },
  modalPrimaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalSecondary: {
    borderRadius: 12,
    backgroundColor: "#e8efe7",
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSecondaryText: {
    color: "#123326",
    fontWeight: "700",
  },
  modalCancel: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#64786e",
    fontWeight: "700",
  },
});
