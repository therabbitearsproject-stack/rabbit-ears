import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, parseTitle, cacheKey, entityYears, entityImdb, kindOf, pick, preferFor } from "./imdb-match.mjs";

test("titles are tidied for comparing", () => {
  assert.equal(norm("The Mystery of Chessboxing"), "mystery of chessboxing");
  assert.equal(norm("Jīng Wǔ Mén"), "jing wu men");
  assert.equal(norm("Abbott & Costello"), "abbott and costello");
});

test("catalog titles become searches", () => {
  assert.deepEqual(parseTitle("Come Drink With Me (1966)", ""), { q: "Come Drink With Me", year: 1966, series: false });
  assert.deepEqual(parseTitle("Enter The Dragon 1973", "2024"), { q: "Enter The Dragon", year: 1973, series: false });
  assert.deepEqual(parseTitle("Master Of The Flying Guillotine 1976 English", ""), { q: "Master Of The Flying Guillotine", year: 1976, series: false });
  assert.deepEqual(parseTitle("Bloody Parrot (1981) 480i DVD Remux", ""), { q: "Bloody Parrot", year: 1981, series: false });
  assert.deepEqual(parseTitle("Northern Exposure · S05E16 · I Feel the Earth Move", "1994"), { q: "Northern Exposure", year: 0, series: true });
  assert.deepEqual(parseTitle("The Magic Blade", "0013"), { q: "The Magic Blade", year: 0, series: false });
  assert.equal(parseTitle("", ""), null);
  assert.equal(parseTitle("A ".repeat(40), ""), null);
  assert.equal(cacheKey(parseTitle("The Magic Blade", "1976"), "film"), "magic blade|1976||film");
});

test("episode titles look up the show", () => {
  const show = q => ({ q, year: 0, series: true });
  assert.deepEqual(parseTitle("Mister Ed S02E14 Ed The Beneficiary", ""), show("Mister Ed"));
  assert.deepEqual(parseTitle("Beverly Hillbillies Ep01 The Clampetts Strike Oil", ""), show("Beverly Hillbillies"));
  assert.deepEqual(parseTitle("The Andy Griffith Show: S3 E23, Andy Discovers America", "1963"), show("The Andy Griffith Show"));
  assert.deepEqual(parseTitle("The Dick Van Dyke Show #31: Never Name a Duck", "1962"), show("The Dick Van Dyke Show"));
  assert.deepEqual(parseTitle("Mister Ed Season 1", "1961"), show("Mister Ed"));
  // "Show: Episode" only counts as an episode on a TV channel; on a movie channel it's a film's title.
  assert.deepEqual(parseTitle("The Beverly Hillbillies: Trick Or Treat", "", "series"), show("The Beverly Hillbillies"));
  assert.deepEqual(parseTitle("Ninja III: The Domination (1984) BD RIP", "", "film"), { q: "Ninja III: The Domination", year: 1984, series: false });
  assert.deepEqual(parseTitle("Petticoat Junction PD Episodes", "", "series"), { q: "Petticoat Junction", year: 0, series: false });
});

test("compilations and collections are skipped", () => {
  assert.equal(parseTitle("Popeye Public Domain Collection", ""), null);
  assert.equal(parseTitle("The Pink Panther (cartoons)", "1964"), null);
  assert.equal(parseTitle("A BUNCH of 2000s Kids' Commercials", ""), null);
});

test("years, IMDb ids and kinds come out of Wikidata", () => {
  const e = { claims: {
    P577: [{ mainsnak: { datavalue: { value: { time: "+1957-03-01T00:00:00Z" } } } }, { mainsnak: { datavalue: { value: { time: "+1959-07-22T00:00:00Z" } } } }],
    P345: [{ mainsnak: { datavalue: { value: "nm0000001" } } }, { mainsnak: { datavalue: { value: "tt0052077" } } }],
  } };
  assert.deepEqual(entityYears(e), [1957, 1959]);
  assert.equal(entityImdb(e), "tt0052077");
  assert.equal(entityImdb({ claims: {} }), "");
  assert.equal(kindOf("1976 film by Chor Yuen"), "film");
  assert.equal(kindOf("American television series"), "series");
  assert.equal(kindOf("episode of Brothers & Sisters (S1 E7)"), "other");
  assert.equal(kindOf("1992 video game"), "other");
});

test("only confident matches are kept", () => {
  const c = (imdb, years, kind, ...labels) => ({ imdb, years, kind, labels });
  const drink = [c("tt1", [1966], "film", "Come Drink with Me"), c("tt2", [2005], "film", "Come Drink With Me")];
  assert.equal(pick({ q: "Come Drink With Me", year: 1966 }, drink), "tt1");      // year decides
  assert.equal(pick({ q: "Come Drink With Me", year: 0 }, drink), "");            // two films, no year: unsure
  assert.equal(pick({ q: "Come Drink With Me", year: 1990 }, drink), "");         // neither year fits
  assert.equal(pick({ q: "Come Drink", year: 0 }, drink), "");                    // not exact
  assert.equal(pick({ q: "Plan 9 from Outer Space", year: 1959 }, [c("tt3", [1957, 1959], "film", "Plan 9 from Outer Space")]), "tt3");
  assert.equal(pick({ q: "Fist of Fury", year: 1972 }, [c("tt4", [1972], "film", "Jing Wu Men", "Fist of Fury")]), "tt4"); // aliases count
  const ne = [c("tt5", [1990], "series", "Northern Exposure"), c("tt6", [2006], "other", "Northern Exposure")];
  assert.equal(pick({ q: "Northern Exposure", year: 0, series: true }, ne), "tt5");  // the episode doesn't count
  const blade = [c("tt7", [1976], "film", "The Magic Blade"), c("tt8", [2012], "series", "The Magic Blade")];
  assert.equal(pick({ q: "The Magic Blade", year: 0 }, blade, "film"), "tt7");      // a film channel wants the film
  assert.equal(pick({ q: "The Magic Blade", year: 0 }, blade), "");                 // no hint: unsure
  const hill = [c("tt9", [1962], "series", "The Beverly Hillbillies"), c("tt10", [1993], "film", "The Beverly Hillbillies")];
  assert.equal(pick({ q: "The Beverly Hillbillies", year: 0 }, hill, "series"), "tt9"); // a TV channel wants the show
  assert.equal(preferFor("Classic TV"), "series");
  assert.equal(preferFor("Movies"), "film");
  assert.equal(preferFor("Kids"), "");
});
