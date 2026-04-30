import { Pressable, StyleSheet, Text, View } from "react-native";
import { quantityLabel } from "../lib";
import type { RecipeRecommendation } from "../types";
import { Chip } from "./Chip";

export function RecipeCard({
  recipe,
  onPress,
}: {
  recipe: RecipeRecommendation;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.cuisine} • {recipe.cookingTimeMinutes} min • {recipe.servings} servings
          </Text>
        </View>
        <View style={styles.scoreBubble}>
          <Text style={styles.scoreText}>{Math.round(recipe.matchScore * 100)}%</Text>
        </View>
      </View>
      <View style={styles.rowWrap}>
        {recipe.rationaleBadges.map((badge) => (
          <Chip
            key={badge}
            label={badge}
            tone={badge.includes("Cookable") ? "success" : badge.includes("Missing") ? "warning" : "neutral"}
          />
        ))}
      </View>
      <Text style={styles.body}>
        Uses {recipe.pantryCoveredIngredients.map((ingredient) => ingredient.name).join(", ") || "your pantry well"}.
      </Text>
      {recipe.missingIngredients.length ? (
        <Text style={styles.missing}>
          Missing:{" "}
          {recipe.missingIngredients.map((ingredient) => quantityLabel(ingredient.quantity, ingredient.unit) + " " + ingredient.name).join(", ")}
        </Text>
      ) : null}
      {recipe.ingredientAlternatives?.length ? (
        <Text style={styles.alt}>
          Alternatives:{" "}
          {recipe.ingredientAlternatives
            .map((entry) => `${entry.missingIngredient} -> ${entry.alternativeIngredient}`)
            .join(", ")}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e6ece2",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#173225",
  },
  meta: {
    fontSize: 13,
    color: "#637266",
    marginTop: 3,
  },
  scoreBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#143c2a",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#f8fbf8",
    fontWeight: "700",
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  body: {
    color: "#415146",
    lineHeight: 20,
  },
  missing: {
    color: "#8b5e00",
    fontWeight: "600",
  },
  alt: {
    color: "#1f5f3a",
    fontWeight: "600",
  },
});
