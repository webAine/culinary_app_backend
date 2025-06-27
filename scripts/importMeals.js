require('dotenv').config();

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1/';

const supabase = createClient(supabaseUrl, supabaseKey);

const fetchMealCategories = async () => {
  try {
    console.log('An attempt to get the categories of dishes from TheMealDB...');

    const res = await axios.get(`${MEALDB_BASE_URL}categories.php`);

    if (res.data && res.data.categories) {
      const categories = res.data.categories;

      console.log(`Received ${categories.length} of categories.`);

      const categoriesToInsert = categories.map((category) => ({
        api_id: category.idCategory,
        name: category.strCategory,
        thumbnail_url: category.strCategoryThumb,
        description: category.strCategoryDescription,
      }));

      console.log('Saving categories in Supabase...');

      const { data, error } = await supabase.from('categories').upsert(categoriesToInsert, { onConflict: 'api_id' });

      if (error) {
        console.error(error);
        throw error;
      }

      console.log('The categories have been successfully saved/updated in Supabase.');

      return data;
    }
  } catch (error) {
    console.error(`Error when requesting the TheMealDB API: ${error}`);

    return [];
  }
};

const fetchMealRecipes = async (letter) => {
  try {
    const res = await axios.get(`${MEALDB_BASE_URL}search.php?f=${letter}`);

    if (res.data && res.data.meals) {
      const meals = res.data.meals;

      const mealsToInsert = meals.map((meal) => {
        const ingredients = [];

        for (let i = 1; i <= 20; i++) {
          const ingredient = meal[`strIngredient${i}`];
          const measure = meal[`strMeasure${i}`];

          if (ingredient && ingredient.trim() !== '') {
            ingredients.push({
              ingredient: ingredient.trim(),
              measure: measure ? measure.trim() : '',
            });
          }
        }

        return {
          api_id: +meal.idMeal,
          name: meal.strMeal,
          category: meal.strCategory,
          area: meal.strArea,
          instructions: meal.strInstructions,
          thumbnail_url: meal.strMealThumb,
          youtube_url: meal.strYoutube,
          source_url: meal.strSource,
          ingredients_json: ingredients,
          tags: meal.strTags || '',
        };
      });

      console.log('Saving recipes in Supabase...');

      const { data, error } = await supabase.from('recipes').upsert(mealsToInsert, { onConflict: 'api_id' });

      if (error) {
        console.error(error);
        throw error;
      }

      console.log('The recipes have been successfully saved/updated in Supabase.');

      return data;
    }
  } catch (error) {
    console.error(`Error when requesting the TheMealDB API: ${error}`);

    return [];
  }
};

const runImportToSupabase = async () => {
  await fetchMealCategories();

  let totalImportedRecipes = 0;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  for (letter of alphabet) {
    console.log(`Processing letter: ${letter.toUpperCase()}`);

    const result = await fetchMealRecipes(letter);

    if (result && result.length > 0) {
      totalImportedRecipes += result.length;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

runImportToSupabase();
