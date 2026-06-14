// Real Taco Bell India outlets (name + real city/state + real address) used to give the agent
// "local context". Weather, the weather-angle suggestion, and the product sales movers are
// DUMMY but plausible — generated deterministically (no external API, zero AI cost). The branch
// names and locations are real; the signals are a simulated demo read.

export type Branch = {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
};

// A representative spread across distinct climates so the weather angle visibly changes per city.
export const BRANCHES: Branch[] = [
  {
    id: "del-vasantkunj",
    name: "Ambience Mall, Vasant Kunj",
    city: "New Delhi",
    state: "Delhi",
    address: "Space No. 8 (T-316 A), Third Floor, Ambience Mall, Vasant Kunj, New Delhi",
  },
  {
    id: "del-cp",
    name: "Connaught Place",
    city: "New Delhi",
    state: "Delhi",
    address: "N1, Ground Floor, Connaught Cir, Block N, Connaught Place, New Delhi",
  },
  {
    id: "blr-koramangala",
    name: "SJR Junction, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    address: "Ground & First Floor, SJR Junction, 100 Ft. Road, Koramangala, Ejipura, Bengaluru",
  },
  {
    id: "blr-phoenix",
    name: "Phoenix Market City, Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    address: "Unit F-25 & 26, 1st Floor, Phoenix Market City, Mahadevapura, K R Puram, Bengaluru",
  },
  {
    id: "hyd-inorbit",
    name: "Inorbit Mall, Madhapur",
    city: "Hyderabad",
    state: "Telangana",
    address: "F&B 05, Inorbit Mall Road, Mindspace, Madhapur, Hyderabad",
  },
  {
    id: "che-vrmall",
    name: "VR Mall, Anna Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    address: "Shop No S-58, No.44, VR Mall, Jawaharlal Nehru Road, Anna Nagar, Chennai",
  },
  {
    id: "pun-seasons",
    name: "Seasons Mall, Magarpatta",
    city: "Pune",
    state: "Maharashtra",
    address: "Shop T-22, Third Floor, Seasons Mall, Magarpatta City, Hadapsar, Pune",
  },
  {
    id: "mum-lowerparel",
    name: "Phoenix Palladium, Lower Parel",
    city: "Mumbai",
    state: "Maharashtra",
    address: "Unit S-14, 2nd Floor, Phoenix Palladium, Phoenix Mills Compound, Lower Parel, Mumbai",
  },
  {
    id: "kol-southcity",
    name: "South City Mall",
    city: "Kolkata",
    state: "West Bengal",
    address: "4th Floor, 375, South City Mall, Prince Anwar Shah Road, Kolkata",
  },
  {
    id: "ahm-onemall",
    name: "Ahmedabad One Mall, Vastrapur",
    city: "Ahmedabad",
    state: "Gujarat",
    address: "3rd Floor, Restaurant No.7, Ahmedabad One Mall, Near Vastrapur Lake, Vastrapur, Ahmedabad",
  },
  {
    id: "jai-wtp",
    name: "World Trade Park, Malviya Nagar",
    city: "Jaipur",
    state: "Rajasthan",
    address: "Shop 04, Food court, 3rd Floor, World Trade Park, JLN Marg, Malviya Nagar, Jaipur",
  },
  {
    id: "tvm-lulu",
    name: "LULU Mall, Akkulam",
    city: "Thiruvananthapuram",
    state: "Kerala",
    address: "91/270-231, Lulu Mall, Akkulam, Kazhakoottam circle, Thiruvananthapuram",
  },
  {
    id: "bho-dbcity",
    name: "DB City Mall, Arera Hills",
    city: "Bhopal",
    state: "Madhya Pradesh",
    address: "T-26, DB City Mall, Opp. MP Nagar, Arera Hills, Bhopal",
  },
  {
    id: "goa-malldegoa",
    name: "Mall De Goa, Porvorim",
    city: "Goa",
    state: "Goa",
    address: "T-05 & T-06, Third floor, Mall De Goa, Pilerne, Goa",
  },
  {
    id: "guw-gsroad",
    name: "GS Road, Christian Basti",
    city: "Guwahati",
    state: "Assam",
    address: "Unit 2, Ground Floor, Opposite Apollo Hospital, Christian Basti, GS Road, Guwahati",
  },
  {
    id: "moh-vrmall",
    name: "VR Punjab, Mohali",
    city: "Mohali",
    state: "Punjab",
    address: "Store S-29/30/31, 2nd Floor, VR Mall, NH-21, Sector 118, Mohali",
  },
];

type Weather = {
  tempC: number;
  condition: string;
  emoji: string;
  // The agent's weather-driven angle for this city today.
  angle: string;
};

// Plausible "today" reads per city (dummy, fixed). Drives the agent suggestion.
const CITY_WEATHER: Record<string, Weather> = {
  "New Delhi": {
    tempC: 41,
    condition: "Dry heat, clear sky",
    emoji: "🌡️",
    angle: "Brutal afternoon heat — lead with chilled drinks & the Chiller combo, and time the send for the 4–7 PM cool-down craving.",
  },
  Bengaluru: {
    tempC: 26,
    condition: "Pleasant, partly cloudy",
    emoji: "⛅",
    angle: "Mild, comfortable evening — perfect for full-meal combos and dine-in nudges rather than just cold drinks.",
  },
  Hyderabad: {
    tempC: 38,
    condition: "Hot & dry",
    emoji: "☀️",
    angle: "Hot and dry — push Chillers and lighter snacking; favour delivery over a midday mall trip.",
  },
  Chennai: {
    tempC: 35,
    condition: "Hot & humid",
    emoji: "🥵",
    angle: "Sticky humidity — beverages + lighter bites convert best; lean on delivery to beat the heat.",
  },
  Pune: {
    tempC: 29,
    condition: "Warm, light breeze",
    emoji: "🌤️",
    angle: "Comfortable weather — a balanced combo offer works; no need to over-index on cold items.",
  },
  Mumbai: {
    tempC: 30,
    condition: "Humid, monsoon showers",
    emoji: "🌧️",
    angle: "Rainy and humid — comfort food + a 'order-in, beat the rain' delivery angle will outperform.",
  },
  Kolkata: {
    tempC: 33,
    condition: "Hot & humid",
    emoji: "🥵",
    angle: "Muggy heat — cold beverages and lighter combos; push delivery in the afternoon.",
  },
  Ahmedabad: {
    tempC: 43,
    condition: "Extreme dry heat",
    emoji: "🔥",
    angle: "Extreme heat — go all-in on Chillers and free-drink bundles; strictly a delivery / evening play.",
  },
  Jaipur: {
    tempC: 40,
    condition: "Dry heat, dusty",
    emoji: "🌡️",
    angle: "Dry desert heat — cold beverages lead; bundle a free drink to lift the average order.",
  },
  Thiruvananthapuram: {
    tempC: 29,
    condition: "Monsoon, steady rain",
    emoji: "🌧️",
    angle: "Steady monsoon rain — 'rainy-day cravings, delivered' is the angle; favour warm, comfort items.",
  },
  Bhopal: {
    tempC: 37,
    condition: "Hot, clear",
    emoji: "☀️",
    angle: "Hot afternoon — Chillers and snack combos; schedule for the early-evening dip.",
  },
  Goa: {
    tempC: 30,
    condition: "Humid, coastal showers",
    emoji: "🌦️",
    angle: "Humid with coastal showers — delivery-first, comfort combos; tourists skew late-evening.",
  },
  Guwahati: {
    tempC: 31,
    condition: "Rainy, overcast",
    emoji: "🌧️",
    angle: "Wet and overcast — warm comfort items + a delivery push will beat a mall visit today.",
  },
  Mohali: {
    tempC: 39,
    condition: "Hot & dry",
    emoji: "🌡️",
    angle: "Hot and dry — cold beverages and value bundles; evening sends will land best.",
  },
};

const DEFAULT_WEATHER: Weather = {
  tempC: 32,
  condition: "Warm",
  emoji: "🌤️",
  angle: "Balanced weather — a standard combo offer works well across the day.",
};

const MENU = [
  "Crunchwrap Supreme",
  "Chicken Quesadilla",
  "Loaded Nachos",
  "Veg Burrito",
  "Crunchy Taco",
  "Chalupa",
  "Cheesy Fries",
  "Quesarito",
  "Volcano Burrito",
  "Churros",
];

// Stable hash so a branch always shows the same "signals" across re-renders.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type BranchSignals = {
  weather: Weather;
  rising: { item: string; pct: number };
  falling: { item: string; pct: number };
};

export function branchSignals(b: Branch): BranchSignals {
  const weather = CITY_WEATHER[b.city] ?? DEFAULT_WEATHER;
  const h = hash(b.id);
  const upItem = MENU[h % MENU.length];
  const downItem = MENU[(h >> 3) % MENU.length];
  const safeDown = downItem === upItem ? MENU[(h >> 3) % MENU.length === 0 ? 1 : 0] : downItem;
  return {
    weather,
    rising: { item: upItem, pct: 8 + (h % 18) }, // +8% … +25%
    falling: { item: safeDown, pct: 5 + ((h >> 5) % 12) }, // -5% … -16%
  };
}
