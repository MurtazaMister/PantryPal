import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#f4f7f1" },
        headerTintColor: "#163627",
        headerTitleStyle: { fontSize: 15, fontWeight: "700" },
        headerTitleAlign: "left",
        tabBarActiveTintColor: "#163627",
        tabBarInactiveTintColor: "#708377",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: -1 },
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 70,
          paddingTop: 6,
          paddingBottom: 14,
          borderRadius: 0,
          backgroundColor: "#fcfdfc",
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="shopping" options={{ title: "Shopping", tabBarIcon: tabIcon("cart-outline") }} />
      <Tabs.Screen name="pantry" options={{ title: "Pantry", tabBarIcon: tabIcon("cube-outline") }} />
      <Tabs.Screen name="cook" options={{ title: "Cook", tabBarIcon: tabIcon("restaurant-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("person-outline") }} />
    </Tabs>
  );
}
