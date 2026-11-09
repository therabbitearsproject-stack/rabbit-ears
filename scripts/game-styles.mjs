// Game styles for the Games tab's filter row. A game can have several styles. They come from the
// Archive item's title, subject tags and description, and hand-picked games can be set directly in
// OVERRIDES. Pure functions: scripts/build-games.mjs uses them, scripts/game-styles.test.mjs tests them.

export const STYLES = [
  { key: "platformer", name: "Platformer", icon: "🏃" },
  { key: "puzzle", name: "Puzzle", icon: "🧩" },
  { key: "physics", name: "Physics & launch", icon: "🎯" },
  { key: "td", name: "Tower defense", icon: "🏰" },
  { key: "strategy", name: "Strategy", icon: "♟️" },
  { key: "shooter", name: "Shooter", icon: "🚀" },
  { key: "arcade", name: "Arcade & action", icon: "🕹️" },
  { key: "fighting", name: "Fighting", icon: "🥊" },
  { key: "racing", name: "Racing & driving", icon: "🏎️" },
  { key: "sports", name: "Sports", icon: "⚽" },
  { key: "rpg", name: "RPG & adventure", icon: "🗡️" },
  { key: "pointclick", name: "Point & click", icon: "🖱️" },
  { key: "sim", name: "Cooking & business", icon: "🍕" },
  { key: "quiz", name: "Quiz & trivia", icon: "❓" },
  { key: "twoplayer", name: "Two-player", icon: "👥" },
  { key: "sandbox", name: "Sandbox & toys", icon: "🎨" },
];

// Checked against the title and tags (strong signals) and the start of the description (weaker:
// only the "only" patterns, which rarely appear by accident).
const RULES = {
  platformer: /\b(platform(er|ing)?|mario|sonic|fancy ?pants|megaman|mega man|jump ?n'? ?run|side-?scroll\w*)\b/,
  puzzle: /\b(puzzles?|logic|brain|bloxor[sz]|tetris|sudoku|mahjong|match[- ]?3|jigsaw|sokoban|maze|riddles?|solitaire|chess|tangram|sugar,? sugar|red remover|bubble shooter|minesweeper|crossword|word game)\b/,
  physics: /\b(physics|ragdoll|cannon|catapult|launch(er)?|toss|fling|learn to fly|crush the castle|trebuchet|demolition)\b/,
  td: /\b(tower ?defen[cs]e|bloons ?td|bloons tower|gemcraft|defend (your|the) (base|castle|tower)|td ?\d)\b/,
  strategy: /\b(strategy|rts|turn[- ]based|territory war|age of war|stick war|warfare|empire|conquer|tactics|army|kingdom)\b/,
  arcade: /\b(arcade|runner|endless|dodge|snake|pac-?man|pac-?xon|breakout|pong|frogger|asteroids|invaders|helicopter|copter|reflex|avoid|ninja|stickman)\b/,
  shooter: /\b(shoot(er|ing|'?em ?up)?|shmup|space invaders|asteroids|bullet hell|tanks?|gunner|sniper|missile)\b/,
  fighting: /\b(fight(er|ing)?|brawl\w*|beat '?em ?up|kung ?fu|karate|boxing|wrestl\w*|smash|electric ?man|street fighter)\b/,
  racing: /\b(rac(e|er|es|ing)|kart|drift|moto ?x?3?m?|motocross|motorbike|truck|bmx|drag ?racer|rally|driving|driver|parking)\b/,
  sports: /\b(soccer|football|basketball|baseball|home run|golf|putt|mini ?golf|tennis|hockey|bowling|skate\w*|snowboard\w*|surf\w*|volleyball|cricket|sports?|olympic\w*|ski(ing)?)\b/,
  rpg: /\b(rpg|role[- ]?playing|adventure|quest|dungeons?|epic battle fantasy|swords and sandals|stick rpg|level ?up|loot)\b/,
  pointclick: /\b(point[- ]and[- ]click|point ?n ?click|escape (the )?room|room escape|escape game|hidden object)\b/,
  sim: /\b(cook\w*|restaurant|papa'?s|pizzeria|burgeria|freezeria|bakeria|diner|shop|store|tycoon|manage(r|ment)?|business|farm\w*|customers?|jacksmith|lemonade)\b/,
  quiz: /\b(quiz\w*|trivia)\b/,
  twoplayer: /\b(2 ?players?|two[- ]players?|2-?play|multiplayer|versus|vs\.? (a )?friend)\b/,
  sandbox: /\b(sandbox|line rider|draw(ing)?|paint|dress[- ]?up|interactive buddy|toy|creator|maker|builder|music (maker|box))\b/,
};

// Hand-checked styles for the Classics shelf and other famous games, used instead of the guess.
export const OVERRIDES = {
  "bloxors": ["puzzle"], "flash_Line_Rider_2": ["sandbox", "physics"], "qwop_flash": ["sports", "physics"],
  "FPA-1": ["platformer"], "portal_flash_version": ["puzzle", "platformer"], "adobeflash-supermario63": ["platformer"],
  "flash_age_of_war": ["strategy"], "bloonstd2_202104": ["td"], "learn_to_fly_2": ["physics"], "helicoptergame_flash": ["shooter"],
  "cubefield_flash": ["racing"], "raft-wars": ["physics", "shooter"], "flash_papaspizzeria": ["sim"], "papasfreezeria_202011": ["sim"],
  "robotunicornattack_flash": ["platformer"], "stick-rpg-complete": ["rpg"], "swords-and-sandals-2": ["rpg", "fighting"],
  "flash_alien_hominid": ["shooter", "platformer"], "tiq2_swf": ["quiz"], "supersmashflash_swf": ["fighting", "twoplayer"],
  "etp_20200826": ["pointclick"], "mother_load": ["rpg"], "desktop-tower-defence_flash": ["td"], "snailbob_flash": ["puzzle"],
  "achievementflash": ["platformer"], "this-is-the-only-level": ["platformer", "puzzle"], "ducklife2worldchampion_flash": ["sports", "rpg"],
  "nv-12": ["platformer"], "tetris_20201126": ["puzzle"], "frogger_swf": ["puzzle"], "shopping-cart-hero": ["physics"],
  "bubble-shooter_swf": ["puzzle"], "super-mario-flash-2": ["platformer", "sandbox"], "dragracerv3_202012": ["racing"],
  // Added November 2026.
  "fancypantsadventure_202011": ["platformer"], "the-fancy-pants-adventure-world-3-1.50": ["platformer"],
  "bloons-tower-defense-3_202201": ["td"], "2611-territory-war": ["strategy", "twoplayer"],
  "Example_flash13": ["fighting"], "stick-war": ["strategy"], "impossible-quiz-deluxe-newgrounds": ["quiz"],
  "fireboy-and-watergirl-3-in-the-ice-temple": ["platformer", "puzzle", "twoplayer"],
  "fireboy-and-watergirl-4-in-the-crystal-temple": ["platformer", "puzzle", "twoplayer"], "ageofwar2_202401": ["strategy"],
  "Example_flash4": ["shooter"], "gemcraft-1716": ["td"], "epic-battle-fantasy-5": ["rpg"], "embeddable_167318": ["rpg"],
  "2369-shift": ["puzzle", "platformer"], "moto-x3m_202309": ["racing", "physics"], "sushi-cat-2": ["physics", "puzzle"],
  "cactus-mccoy": ["platformer", "fighting"], "ragdollcannon2_flash": ["physics", "puzzle"], "redremover_flash": ["physics", "puzzle"],
  "wonderputt-kongregate": ["sports", "puzzle"], "duck-life-4_20210406": ["sports", "rpg"], "jacksmithflashgame": ["sim"],
  "sugarsugar_flash": ["puzzle", "physics"], "warfare-1917": ["strategy"], "worlds-hardest-game": ["puzzle"], "penguin_diner": ["sim"],
  "tank-trouble_flash": ["shooter", "twoplayer"], "bloons-td-5_202205": ["td"], "miniputt": ["sports"],
};

const flat = v => [].concat(v ?? []).join(" ").toLowerCase();
const plain = html => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

// Up to three styles for a game, strongest first (title/tag matches before description matches).
export function stylesFor(id, title, subjects, description) {
  if (OVERRIDES[id]) return OVERRIDES[id];
  const head = (flat(title) + " | " + flat(subjects)).replace(/_/g, " ");
  const body = plain(flat(description)).slice(0, 700);
  const out = Object.keys(RULES).filter(k => RULES[k].test(head));
  // Descriptions mention lots of words in passing, so only the clearest styles count from there.
  for (const k of ["td", "pointclick", "twoplayer", "platformer", "rpg", "quiz"]) if (!out.includes(k) && RULES[k].test(body)) out.push(k);
  return out.slice(0, 3);
}

// Shelves whose search already says what kind of game it is. A game with no style of its own takes
// its shelf's style, so the filter can find it.
export const SHELF_STYLE = { "Puzzle & brain": "puzzle", "Action & arcade": "arcade", "Sports & racing": "sports", "Adventure & RPG": "rpg" };
