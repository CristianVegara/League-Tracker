import assert from "node:assert/strict";
import test from "node:test";

import { generateFixtures, recommendedRounds, totalMatchesFor } from "../src/domain/fixtures.js";
import { computeStandings } from "../src/domain/standings.js";
import { computeSwissStandings, generateNextSwissRound, generateSwissRound1, swissConfigFor } from "../src/domain/swiss.js";
import { generatePlayoffBracket } from "../src/domain/playoffs.js";
import { migrateData, readCompetitionImportPayload } from "../src/data/migrations.js";

const players = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Beto" },
  { id: "c", name: "Cris" },
  { id: "d", name: "Dani" }
];

test("round-robin fixtures include every pair once", () => {
  const matches = generateFixtures(players.map(player => player.id), recommendedRounds(players.length));
  const pairs = new Set(matches.map(match => [match.playerAId, match.playerBId].sort().join("__")));

  assert.equal(totalMatchesFor(players.length), 6);
  assert.equal(matches.length, 6);
  assert.equal(pairs.size, 6);
});

test("league standings sort by points, map difference, then maps for", () => {
  const league = {
    players,
    matches: [
      { playerAId: "a", playerBId: "b", mapsA: 2, mapsB: 0 },
      { playerAId: "c", playerBId: "d", mapsA: 1, mapsB: 1 },
      { playerAId: "a", playerBId: "c", mapsA: 1, mapsB: 2 }
    ]
  };

  const rows = computeStandings(league);

  assert.equal(rows[0].player.id, "c");
  assert.equal(rows[0].Pts, 4);
  assert.equal(rows[1].player.id, "a");
  assert.equal(rows[1].Pts, 3);
});

test("legacy storage shape migrates to competitions", () => {
  const migrated = migrateData({ leagues: [{ id: "x", type: "league" }], activeLeagueId: "x" });

  assert.equal(migrated.version, 1);
  assert.equal(migrated.activeCompetitionId, "x");
  assert.equal(migrated.competitions.length, 1);
});

test("import parser accepts old and new permissive formats", () => {
  assert.equal(readCompetitionImportPayload({ leagues: [{ id: "l" }] }).length, 1);
  assert.equal(readCompetitionImportPayload({ competitions: [{ id: "c" }] }).length, 1);
  assert.equal(readCompetitionImportPayload({ id: "single" }).length, 1);
  assert.equal(readCompetitionImportPayload({ nope: true }), null);
});

test("swiss first round handles odd player by assigning one bye", () => {
  const oddPlayers = players.slice(0, 3);
  const matches = generateSwissRound1(oddPlayers);

  assert.equal(matches.filter(match => match.isBye).length, 1);
  assert.equal(matches.filter(match => !match.isBye).length, 1);
});

test("swiss standings count byes and played matches", () => {
  const tournament = {
    players: players.slice(0, 3),
    matches: [
      { round: 1, playerAId: "a", playerBId: "b", isBye: false, mapsA: 2, mapsB: 1 },
      { round: 1, playerAId: "c", playerBId: null, isBye: true, mapsA: null, mapsB: null }
    ]
  };

  const rows = computeSwissStandings(tournament);

  assert.equal(rows[0].Pts, 3);
  assert.equal(rows[1].Pts, 3);
  assert.equal(rows.find(row => row.player.id === "c").hasHadBye, true);
});

test("next swiss round can be generated after completed round", () => {
  const tournament = {
    players,
    currentRound: 1,
    matches: [
      { round: 1, playerAId: "a", playerBId: "b", isBye: false, mapsA: 2, mapsB: 0 },
      { round: 1, playerAId: "c", playerBId: "d", isBye: false, mapsA: 2, mapsB: 1 }
    ]
  };

  assert.equal(generateNextSwissRound(tournament), true);
  assert.equal(tournament.currentRound, 2);
  assert.equal(tournament.matches.filter(match => match.round === 2).length, 2);
});

test("playoff bracket uses configured top cut", () => {
  const cfg = swissConfigFor(players.length);
  const tournament = {
    players,
    playoffSize: cfg.playoffSize,
    matches: [
      { round: 1, playerAId: "a", playerBId: "b", isBye: false, mapsA: 2, mapsB: 0 },
      { round: 1, playerAId: "c", playerBId: "d", isBye: false, mapsA: 2, mapsB: 1 }
    ]
  };

  generatePlayoffBracket(tournament);

  assert.equal(tournament.playoffs.size, 4);
  assert.equal(tournament.playoffs.rounds[0].length, 2);
  assert.equal(tournament.playoffs.rounds[1].length, 1);
});
