import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Chip } from "../../src/components/Chip";
import { Screen } from "../../src/components/Screen";
import { SectionCard } from "../../src/components/SectionCard";
import { quantityLabel } from "../../src/lib";
import { useAppStore } from "../../src/store/useAppStore";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const latestRecommendations = useAppStore((state) => state.latestRecommendations);
  const recipes = useAppStore((state) => state.recipes);
  const createRecipeDraft = useAppStore((state) => state.createRecipeDraft);
  const addMissingIngredientsToShopping = useAppStore((state) => state.addMissingIngredientsToShopping);
  const selectedMealType = useAppStore((state) => state.selectedMealType);

  const recipe =
    latestRecommendations.find((entry) => entry.id === id) ??
    latestRecommendations.find((entry) => entry.id === recipes.find((item) => item.id === id)?.id);

  if (!recipe) {
    return (
      <Screen>
        <SectionCard title="Recipe unavailable">
          <Text>The recipe could not be loaded from the current recommendation set.</Text>
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.meta}>
          {recipe.cuisine} - {recipe.cookingTimeMinutes} min - {recipe.equipment.join(", ")}
        </Text>
      </View>

      <View style={styles.badges}>
        {recipe.rationaleBadges.map((badge) => (
          <Chip key={badge} label={badge} />
        ))}
      </View>

      <SectionCard title="Ingredients">
        {recipe.ingredients.map((ingredient) => (
          <Text key={`${recipe.id}-${ingredient.name}`} style={styles.line}>
            {quantityLabel(ingredient.quantity, ingredient.unit)} {ingredient.name}
          </Text>
        ))}
      </SectionCard>

      <SectionCard title="Method">
        {recipe.steps.map((step, index) => (
          <Text key={`${recipe.id}-step-${index}`} style={styles.line}>
            {index + 1}. {step}
          </Text>
        ))}
      </SectionCard>

      <Pressable
        style={styles.primary}
        onPress={() => {
          const draftId = createRecipeDraft(recipe.id, recipe.servings, selectedMealType);
          if (draftId) {
            router.push(`/deduction-review/${draftId}`);
          }
        }}
      >
        <Text style={styles.primaryText}>I cooked this</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => addMissingIngredientsToShopping(recipe.id)}>
        <Text style={styles.secondaryText}>Add missing ingredients to shopping list</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#13271d",
  },
  meta: {
    color: "#5a6a5f",
    fontSize: 15,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  line: {
    color: "#435248",
    lineHeight: 22,
  },
  primary: {
    backgroundColor: "#153a2a",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
  },
  secondary: {
    backgroundColor: "#e5efe4",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryText: {
    color: "#173225",
    fontWeight: "700",
  },
});
