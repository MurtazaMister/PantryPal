import * as Notifications from "expo-notifications";
import type { ReminderPreferences } from "../types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const next = await Notifications.requestPermissionsAsync();
  return next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function nextHourTrigger(hour: number, minute: number) {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  } as Notifications.DailyTriggerInput;
}

export async function scheduleMealReminders(preferences: ReminderPreferences) {
  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return false;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const schedules: Array<Promise<string>> = [];
  if (preferences.breakfastEnabled) {
    schedules.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Breakfast check-in",
          body: "Good morning. Use what is already in your pantry before buying more.",
          data: { targetRoute: "/cook", mealType: "breakfast", triggerKind: "meal_reminder" },
        },
        trigger: nextHourTrigger(preferences.breakfastWindow[0], 30),
      }),
    );
  }
  if (preferences.lunchEnabled) {
    schedules.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Lunch plan",
          body: "PantryPal has a few quick lunch ideas ready.",
          data: { targetRoute: "/cook", mealType: "lunch", triggerKind: "meal_reminder" },
        },
        trigger: nextHourTrigger(preferences.lunchWindow[0], 15),
      }),
    );
  }
  if (preferences.dinnerEnabled) {
    schedules.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Dinner reminder",
          body: "Your pantry is ready for tonight's meal. Log what you cook after dinner.",
          data: { targetRoute: "/cook", mealType: "dinner", triggerKind: "meal_reminder" },
        },
        trigger: nextHourTrigger(preferences.dinnerWindow[0], 0),
      }),
    );
  }

  await Promise.all(schedules);
  return true;
}
