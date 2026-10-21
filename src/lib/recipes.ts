// 40 original recipes written for PantryPilot (not copied from any cookbook).
// Ingredient names use catalog names so the matcher can line them up with stock.

export interface Recipe {
	id: string;
	title: string;
	veg: boolean;
	minutes: number;
	servings: number;
	ingredients: string[];
	steps: string[];
}

export const RECIPES: Recipe[] = [
	{
		id: 'tomato-dal',
		title: 'Everyday Tomato Dal',
		veg: true,
		minutes: 30,
		servings: 4,
		ingredients: ['Toor Dal', 'Tomato', 'Onion', 'Turmeric Powder', 'Chilli Powder', 'Mustard Seeds', 'Curry Leaves', 'Salt'],
		steps: [
			'Rinse the dal and pressure cook with turmeric and three cups of water until soft.',
			'Chop the onion and tomato. Heat oil, pop the mustard seeds, add curry leaves.',
			'Fry the onion until translucent, add tomato and chilli powder, cook until the tomato collapses.',
			'Stir in the cooked dal, add salt and simmer five minutes. Mash lightly and serve with rice.'
		]
	},
	{
		id: 'paneer-butter-masala',
		title: 'Soft Paneer Butter Masala',
		veg: true,
		minutes: 35,
		servings: 3,
		ingredients: ['Paneer', 'Tomato', 'Onion', 'Butter', 'Cream', 'Ginger Garlic Paste', 'Garam Masala', 'Chilli Powder', 'Salt'],
		steps: [
			'Blend the tomato and onion into a smooth puree.',
			'Melt butter, add the ginger garlic paste and fry for a minute.',
			'Pour in the puree with chilli powder and salt. Cook until the butter separates.',
			'Add garam masala, cubed paneer and cream. Simmer four minutes without boiling hard.'
		]
	},
	{
		id: 'veg-pulao',
		title: 'One-Pot Vegetable Pulao',
		veg: true,
		minutes: 30,
		servings: 4,
		ingredients: ['Basmati Rice', 'Carrot', 'Beans', 'Peas', 'Onion', 'Ghee', 'Cardamom', 'Cinnamon', 'Bay Leaf', 'Salt'],
		steps: [
			'Soak the rice for twenty minutes and drain.',
			'Heat ghee, add the whole spices, then the sliced onion and fry golden.',
			'Add the diced carrot, beans and peas, saute two minutes.',
			'Add rice, salt and one and a half cups water per cup of rice. Cook covered on low until done, rest ten minutes.'
		]
	},
	{
		id: 'chicken-curry',
		title: 'Home-Style Chicken Curry',
		veg: false,
		minutes: 45,
		servings: 4,
		ingredients: ['Chicken', 'Onion', 'Tomato', 'Ginger Garlic Paste', 'Chilli Powder', 'Turmeric Powder', 'Coriander Powder', 'Garam Masala', 'Curd', 'Salt'],
		steps: [
			'Marinate the chicken in curd, turmeric and salt for twenty minutes.',
			'Fry sliced onion until deep golden, add ginger garlic paste.',
			'Add chopped tomato and the powdered spices, cook until thick.',
			'Add the chicken, sear, then cover and simmer with a little water until tender. Finish with garam masala.'
		]
	},
	{
		id: 'masala-omelette',
		title: 'Masala Omelette',
		veg: false,
		minutes: 10,
		servings: 1,
		ingredients: ['Eggs', 'Onion', 'Green Chilli', 'Coriander Leaves', 'Salt', 'Black Pepper'],
		steps: [
			'Beat the eggs with salt and pepper until frothy.',
			'Stir in finely chopped onion, chilli and coriander.',
			'Pour into a hot oiled pan, cook on medium until set, fold and serve.'
		]
	},
	{
		id: 'curd-rice',
		title: 'Cooling Curd Rice',
		veg: true,
		minutes: 20,
		servings: 2,
		ingredients: ['Rice', 'Curd', 'Milk', 'Mustard Seeds', 'Curry Leaves', 'Green Chilli', 'Ginger', 'Salt'],
		steps: [
			'Cook the rice soft and mash it lightly while warm.',
			'Cool, then mix in curd, a splash of milk and salt.',
			'Temper mustard seeds, curry leaves, chilli and grated ginger in oil and pour over.'
		]
	},
	{
		id: 'aloo-paratha',
		title: 'Stuffed Potato Paratha',
		veg: true,
		minutes: 40,
		servings: 3,
		ingredients: ['Wheat Flour', 'Potato', 'Onion', 'Green Chilli', 'Coriander Leaves', 'Chilli Powder', 'Butter', 'Salt'],
		steps: [
			'Knead a soft dough with wheat flour, salt and water. Rest it twenty minutes.',
			'Boil and mash the potato, mix with onion, chilli, coriander, chilli powder and salt.',
			'Stuff a dough ball with the filling, seal and roll gently.',
			'Cook on a hot tawa with butter on both sides until spotted brown.'
		]
	},
	{
		id: 'tomato-rasam',
		title: 'Clear Tomato Rasam',
		veg: true,
		minutes: 25,
		servings: 4,
		ingredients: ['Tomato', 'Tamarind', 'Rasam Powder', 'Garlic', 'Curry Leaves', 'Mustard Seeds', 'Coriander Leaves', 'Salt'],
		steps: [
			'Soak tamarind in warm water and extract the juice.',
			'Crush the tomato and garlic, add to the tamarind water with rasam powder and salt.',
			'Simmer until frothy but do not boil hard.',
			'Temper mustard seeds and curry leaves, pour in and finish with coriander.'
		]
	},
	{
		id: 'veg-fried-rice',
		title: 'Quick Vegetable Fried Rice',
		veg: true,
		minutes: 20,
		servings: 3,
		ingredients: ['Rice', 'Carrot', 'Cabbage', 'Spring Onion', 'Capsicum', 'Soy Sauce', 'Black Pepper', 'Salt'],
		steps: [
			'Use day-old cooked rice so the grains stay separate.',
			'Stir fry the shredded vegetables on high heat for two minutes.',
			'Add the rice, soy sauce, pepper and salt. Toss hard for three minutes.',
			'Top with chopped spring onion greens.'
		]
	},
	{
		id: 'egg-bhurji',
		title: 'Egg Bhurji',
		veg: false,
		minutes: 15,
		servings: 2,
		ingredients: ['Eggs', 'Onion', 'Tomato', 'Green Chilli', 'Turmeric Powder', 'Chilli Powder', 'Coriander Leaves', 'Salt'],
		steps: [
			'Fry onion and chilli until soft, add tomato and cook down.',
			'Add turmeric, chilli powder and salt.',
			'Pour in the beaten eggs and scramble on low heat until just set. Finish with coriander.'
		]
	},
	{
		id: 'banana-smoothie',
		title: 'Banana Milk Smoothie',
		veg: true,
		minutes: 5,
		servings: 2,
		ingredients: ['Banana', 'Milk', 'Honey', 'Cardamom'],
		steps: ['Blend banana, cold milk, honey and a pinch of cardamom until smooth.', 'Serve immediately.']
	},
	{
		id: 'upma',
		title: 'Soft Rava Upma',
		veg: true,
		minutes: 20,
		servings: 3,
		ingredients: ['Rava', 'Onion', 'Green Chilli', 'Ginger', 'Mustard Seeds', 'Curry Leaves', 'Ghee', 'Salt'],
		steps: [
			'Dry roast the rava until it smells nutty, set aside.',
			'Temper mustard seeds, curry leaves, chilli and ginger in ghee, add onion and fry soft.',
			'Add three cups of water per cup of rava with salt, bring to a boil.',
			'Rain in the rava while stirring, cover and steam five minutes.'
		]
	},
	{
		id: 'poha',
		title: 'Light Onion Poha',
		veg: true,
		minutes: 15,
		servings: 2,
		ingredients: ['Poha', 'Onion', 'Potato', 'Peanuts', 'Turmeric Powder', 'Green Chilli', 'Lemon', 'Curry Leaves', 'Salt'],
		steps: [
			'Rinse the poha in a colander and let it sit so it softens without turning mushy.',
			'Fry peanuts, then onion, potato cubes, chilli and curry leaves.',
			'Add turmeric and salt, fold in the poha, cover two minutes.',
			'Squeeze lemon over before serving.'
		]
	},
	{
		id: 'chana-masala',
		title: 'Chickpea Masala',
		veg: true,
		minutes: 40,
		servings: 4,
		ingredients: ['Chole', 'Onion', 'Tomato', 'Ginger Garlic Paste', 'Garam Masala', 'Chilli Powder', 'Coriander Powder', 'Salt'],
		steps: [
			'Soak the chickpeas overnight and pressure cook with salt until soft.',
			'Brown the onion, add ginger garlic paste, then tomato and the spice powders.',
			'Add the chickpeas with some cooking liquid. Simmer fifteen minutes until thick.',
			'Mash a few chickpeas to thicken the gravy.'
		]
	},
	{
		id: 'palak-paneer',
		title: 'Palak Paneer',
		veg: true,
		minutes: 30,
		servings: 3,
		ingredients: ['Spinach', 'Paneer', 'Onion', 'Garlic', 'Green Chilli', 'Cream', 'Cumin Seeds', 'Salt'],
		steps: [
			'Blanch the spinach for one minute, cool in cold water, then blend with chilli.',
			'Fry cumin, garlic and onion until golden.',
			'Add the spinach puree and salt, cook five minutes on low.',
			'Fold in paneer cubes and a spoon of cream.'
		]
	},
	{
		id: 'bhindi-fry',
		title: 'Crisp Bhindi Fry',
		veg: true,
		minutes: 25,
		servings: 3,
		ingredients: ['Ladies Finger', 'Onion', 'Turmeric Powder', 'Chilli Powder', 'Besan', 'Salt'],
		steps: [
			'Wipe the okra completely dry and slice into rounds.',
			'Fry on medium-high without stirring too often so it does not turn sticky.',
			'Add onion, turmeric, chilli powder and salt.',
			'Sprinkle besan at the end and toss until crisp.'
		]
	},
	{
		id: 'fish-fry',
		title: 'Pan Fish Fry',
		veg: false,
		minutes: 25,
		servings: 3,
		ingredients: ['Fish', 'Chilli Powder', 'Turmeric Powder', 'Ginger Garlic Paste', 'Lemon', 'Rice Flour', 'Salt'],
		steps: [
			'Marinate fish with chilli powder, turmeric, ginger garlic paste, lemon and salt for twenty minutes.',
			'Dust with rice flour for a crisp crust.',
			'Shallow fry on medium heat, three to four minutes per side.'
		]
	},
	{
		id: 'veg-sandwich',
		title: 'Grilled Veg Sandwich',
		veg: true,
		minutes: 12,
		servings: 2,
		ingredients: ['Bread', 'Butter', 'Cucumber', 'Tomato', 'Onion', 'Cheese Slices', 'Chat Masala', 'Salt'],
		steps: [
			'Butter the bread slices on the outside.',
			'Layer thin cucumber, tomato, onion and cheese. Sprinkle chat masala and salt.',
			'Grill or pan press until golden and the cheese melts.'
		]
	},
	{
		id: 'lemon-rice',
		title: 'Lemon Rice',
		veg: true,
		minutes: 20,
		servings: 3,
		ingredients: ['Rice', 'Lemon', 'Peanuts', 'Mustard Seeds', 'Chana Dal', 'Curry Leaves', 'Turmeric Powder', 'Green Chilli', 'Salt'],
		steps: [
			'Cook and cool the rice so the grains stay separate.',
			'Temper mustard seeds, chana dal, peanuts, chilli and curry leaves.',
			'Add turmeric, switch off, then mix into the rice with lemon juice and salt.'
		]
	},
	{
		id: 'mixed-veg-sabzi',
		title: 'Mixed Vegetable Sabzi',
		veg: true,
		minutes: 25,
		servings: 4,
		ingredients: ['Potato', 'Carrot', 'Beans', 'Peas', 'Cauliflower', 'Cumin Seeds', 'Turmeric Powder', 'Coriander Powder', 'Salt'],
		steps: [
			'Cut all the vegetables to a similar size so they cook evenly.',
			'Temper cumin, add the vegetables with turmeric, coriander powder and salt.',
			'Cover and cook on low with a splash of water until just tender, not mushy.'
		]
	},
	{
		id: 'tomato-soup',
		title: 'Fresh Tomato Soup',
		veg: true,
		minutes: 25,
		servings: 3,
		ingredients: ['Tomato', 'Onion', 'Garlic', 'Butter', 'Black Pepper', 'Sugar', 'Cream', 'Salt'],
		steps: [
			'Simmer tomato, onion and garlic with water until very soft.',
			'Blend and strain for a smooth soup.',
			'Reheat with butter, salt, pepper and a pinch of sugar. Swirl in cream.'
		]
	},
	{
		id: 'besan-chilla',
		title: 'Besan Chilla',
		veg: true,
		minutes: 15,
		servings: 2,
		ingredients: ['Besan', 'Onion', 'Tomato', 'Green Chilli', 'Coriander Leaves', 'Turmeric Powder', 'Salt'],
		steps: [
			'Whisk besan with water into a pourable batter with no lumps.',
			'Stir in the chopped vegetables, turmeric and salt.',
			'Spread thin on a hot pan, drizzle oil and cook both sides.'
		]
	},
	{
		id: 'chicken-fried-rice',
		title: 'Chicken Fried Rice',
		veg: false,
		minutes: 25,
		servings: 3,
		ingredients: ['Rice', 'Chicken', 'Eggs', 'Spring Onion', 'Capsicum', 'Soy Sauce', 'Black Pepper', 'Salt'],
		steps: [
			'Cook and shred the chicken small.',
			'Scramble the eggs and keep aside.',
			'Stir fry the vegetables on high, add chicken, rice, soy sauce, pepper and salt.',
			'Fold the egg back in and finish with spring onion.'
		]
	},
	{
		id: 'dal-khichdi',
		title: 'Comfort Dal Khichdi',
		veg: true,
		minutes: 30,
		servings: 3,
		ingredients: ['Rice', 'Moong Dal', 'Ghee', 'Cumin Seeds', 'Turmeric Powder', 'Ginger', 'Salt'],
		steps: [
			'Rinse rice and dal together in equal parts.',
			'Temper cumin and ginger in ghee, add turmeric.',
			'Add rice, dal, salt and four cups water. Pressure cook to a soft porridge.',
			'Top with more ghee before serving.'
		]
	},
	{
		id: 'cabbage-poriyal',
		title: 'Cabbage Poriyal',
		veg: true,
		minutes: 20,
		servings: 3,
		ingredients: ['Cabbage', 'Coconut', 'Mustard Seeds', 'Urad Dal', 'Green Chilli', 'Curry Leaves', 'Salt'],
		steps: [
			'Shred the cabbage finely.',
			'Temper mustard seeds, urad dal, chilli and curry leaves.',
			'Add cabbage and salt, cook uncovered so it stays crunchy.',
			'Finish with grated coconut.'
		]
	},
	{
		id: 'paneer-bhurji',
		title: 'Paneer Bhurji',
		veg: true,
		minutes: 18,
		servings: 2,
		ingredients: ['Paneer', 'Onion', 'Tomato', 'Capsicum', 'Turmeric Powder', 'Garam Masala', 'Coriander Leaves', 'Salt'],
		steps: [
			'Crumble the paneer coarsely.',
			'Fry onion, capsicum and tomato until soft, add turmeric and salt.',
			'Add paneer, toss two minutes, finish with garam masala and coriander.'
		]
	},
	{
		id: 'french-toast',
		title: 'Savoury French Toast',
		veg: false,
		minutes: 12,
		servings: 2,
		ingredients: ['Bread', 'Eggs', 'Milk', 'Black Pepper', 'Butter', 'Salt'],
		steps: [
			'Beat eggs with milk, salt and pepper.',
			'Soak each bread slice briefly on both sides.',
			'Fry in butter until golden on both sides.'
		]
	},
	{
		id: 'veg-noodles',
		title: 'Street-Style Veg Noodles',
		veg: true,
		minutes: 20,
		servings: 2,
		ingredients: ['Noodles', 'Cabbage', 'Carrot', 'Capsicum', 'Spring Onion', 'Soy Sauce', 'Chilli Sauce', 'Black Pepper', 'Salt'],
		steps: [
			'Boil the noodles until just done, rinse in cold water and toss with a little oil.',
			'Stir fry the julienned vegetables on high heat.',
			'Add noodles, sauces, pepper and salt. Toss quickly and serve hot.'
		]
	},
	{
		id: 'masala-chai',
		title: 'Masala Chai',
		veg: true,
		minutes: 10,
		servings: 2,
		ingredients: ['Tea Powder', 'Milk', 'Sugar', 'Ginger', 'Cardamom'],
		steps: [
			'Boil water with crushed ginger and cardamom for two minutes.',
			'Add tea powder and sugar, boil one minute.',
			'Pour in milk, bring to a rolling boil once and strain.'
		]
	},
	{
		id: 'rajma-masala',
		title: 'Rajma Masala',
		veg: true,
		minutes: 50,
		servings: 4,
		ingredients: ['Rajma', 'Onion', 'Tomato', 'Ginger Garlic Paste', 'Garam Masala', 'Chilli Powder', 'Cumin Seeds', 'Salt'],
		steps: [
			'Soak rajma overnight, then pressure cook with salt until very soft.',
			'Fry cumin, onion and ginger garlic paste until browned.',
			'Add tomato and spices, cook until the oil separates.',
			'Add rajma with its liquid and simmer twenty minutes.'
		]
	},
	{
		id: 'carrot-halwa',
		title: 'Carrot Halwa',
		veg: true,
		minutes: 45,
		servings: 4,
		ingredients: ['Carrot', 'Milk', 'Sugar', 'Ghee', 'Cardamom', 'Cashews'],
		steps: [
			'Grate the carrot finely.',
			'Cook it in milk on medium heat until the milk is almost gone.',
			'Add sugar and ghee, stir until thick and glossy.',
			'Finish with cardamom and fried cashews.'
		]
	},
	{
		id: 'chicken-65',
		title: 'Spiced Chicken Fry',
		veg: false,
		minutes: 35,
		servings: 3,
		ingredients: ['Chicken', 'Curd', 'Corn Flour', 'Chilli Powder', 'Ginger Garlic Paste', 'Curry Leaves', 'Lemon', 'Salt'],
		steps: [
			'Marinate chicken cubes in curd, chilli powder, ginger garlic paste and salt for thirty minutes.',
			'Coat with corn flour.',
			'Deep or shallow fry until crisp and cooked through.',
			'Toss with fried curry leaves and a squeeze of lemon.'
		]
	},
	{
		id: 'veg-raita',
		title: 'Cucumber Raita',
		veg: true,
		minutes: 8,
		servings: 3,
		ingredients: ['Curd', 'Cucumber', 'Onion', 'Coriander Leaves', 'Cumin Seeds', 'Salt'],
		steps: [
			'Whisk the curd smooth with salt.',
			'Add grated cucumber and chopped onion.',
			'Sprinkle roasted cumin powder and coriander.'
		]
	},
	{
		id: 'pasta-red-sauce',
		title: 'Red Sauce Pasta',
		veg: true,
		minutes: 25,
		servings: 2,
		ingredients: ['Pasta', 'Tomato', 'Onion', 'Garlic', 'Capsicum', 'Oregano', 'Chilli Flakes', 'Cheese Slices', 'Salt'],
		steps: [
			'Boil the pasta in salted water until al dente, reserve a cup of the water.',
			'Blend blanched tomato into a puree.',
			'Fry garlic, onion and capsicum, add the puree, oregano, chilli flakes and salt. Simmer ten minutes.',
			'Toss the pasta through with a little pasta water and top with cheese.'
		]
	},
	{
		id: 'aloo-gobi',
		title: 'Aloo Gobi',
		veg: true,
		minutes: 30,
		servings: 4,
		ingredients: ['Potato', 'Cauliflower', 'Onion', 'Tomato', 'Turmeric Powder', 'Coriander Powder', 'Cumin Seeds', 'Salt'],
		steps: [
			'Cut the potato and cauliflower into even florets and cubes.',
			'Temper cumin, add onion and tomato, cook soft.',
			'Add the vegetables with turmeric, coriander powder and salt.',
			'Cover and cook on low, stirring rarely so the florets stay whole.'
		]
	},
	{
		id: 'bread-upma',
		title: 'Leftover Bread Upma',
		veg: true,
		minutes: 15,
		servings: 2,
		ingredients: ['Bread', 'Onion', 'Tomato', 'Green Chilli', 'Mustard Seeds', 'Curry Leaves', 'Turmeric Powder', 'Salt'],
		steps: [
			'Cut slightly stale bread into cubes.',
			'Temper mustard seeds and curry leaves, fry onion, chilli and tomato.',
			'Add turmeric and salt, then the bread cubes. Toss gently until coated and warm.'
		]
	},
	{
		id: 'sprouts-salad',
		title: 'Sprouts Chaat Salad',
		veg: true,
		minutes: 10,
		servings: 2,
		ingredients: ['Sprouts', 'Onion', 'Tomato', 'Cucumber', 'Lemon', 'Chat Masala', 'Coriander Leaves', 'Salt'],
		steps: [
			'Steam the sprouts for five minutes if you prefer them soft.',
			'Toss with the chopped vegetables.',
			'Dress with lemon, chat masala, salt and coriander.'
		]
	},
	{
		id: 'mushroom-masala',
		title: 'Mushroom Masala',
		veg: true,
		minutes: 25,
		servings: 3,
		ingredients: ['Mushroom', 'Onion', 'Tomato', 'Ginger Garlic Paste', 'Garam Masala', 'Chilli Powder', 'Coriander Leaves', 'Salt'],
		steps: [
			'Quarter the mushrooms and dry-fry them to drive off the water.',
			'Fry onion and ginger garlic paste, add tomato and spices.',
			'Return the mushrooms, cook five minutes and finish with coriander.'
		]
	},
	{
		id: 'oats-porridge',
		title: 'Banana Oats Porridge',
		veg: true,
		minutes: 10,
		servings: 2,
		ingredients: ['Oats', 'Milk', 'Banana', 'Honey', 'Almonds', 'Cardamom'],
		steps: [
			'Simmer the oats in milk for five minutes until creamy.',
			'Add sliced banana and a pinch of cardamom.',
			'Sweeten with honey and top with chopped almonds.'
		]
	},
	{
		id: 'prawn-masala',
		title: 'Prawn Masala',
		veg: false,
		minutes: 30,
		servings: 3,
		ingredients: ['Prawns', 'Onion', 'Tomato', 'Coconut', 'Chilli Powder', 'Turmeric Powder', 'Curry Leaves', 'Salt'],
		steps: [
			'Clean the prawns and toss with turmeric and salt.',
			'Fry onion and curry leaves, add tomato, chilli powder and grated coconut.',
			'Add the prawns and cook just five to six minutes so they stay tender.'
		]
	}
];
