import { uid } from "../utils/ids.js";

export function circleMethod(playerIds){
  const ids = playerIds.slice();
  if(ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const fixed = ids[0];
  const rest = ids.slice(1);
  const rounds = [];

  for(let r = 0; r < n - 1; r++){
    const roundIds = [fixed, ...rest];
    const roundMatches = [];
    for(let i = 0; i < n / 2; i++){
      const a = roundIds[i];
      const b = roundIds[n - 1 - i];
      if(a !== null && b !== null) roundMatches.push([a, b]);
    }
    rounds.push(roundMatches);
    rest.unshift(rest.pop());
  }

  return rounds;
}

export function flattenInterleaved(rounds){
  const maxLen = Math.max(0, ...rounds.map(r => r.length));
  const flat = [];
  for(let i = 0; i < maxLen; i++){
    for(let r = 0; r < rounds.length; r++){
      if(rounds[r][i]) flat.push(rounds[r][i]);
    }
  }
  return flat;
}

export function distributeMatches(matches, numRounds){
  const buckets = Array.from({ length: numRounds }, () => ({ matches: [], used: new Set() }));
  matches.forEach(([a, b]) => {
    let candidates = buckets
      .map((bucket, idx) => ({ idx, bucket }))
      .filter(item => !item.bucket.used.has(a) && !item.bucket.used.has(b));
    if(candidates.length === 0){
      candidates = buckets.map((bucket, idx) => ({ idx, bucket }));
    }
    candidates.sort((x, y) => x.bucket.matches.length - y.bucket.matches.length || x.idx - y.idx);
    const chosen = candidates[0].bucket;
    chosen.matches.push([a, b]);
    chosen.used.add(a);
    chosen.used.add(b);
  });
  return buckets.map(bucket => bucket.matches);
}

export function recommendedRounds(playerCount){
  return playerCount % 2 === 0 ? playerCount - 1 : playerCount;
}

export function totalMatchesFor(playerCount){
  return playerCount * (playerCount - 1) / 2;
}

export function generateFixtures(playerIds, numRounds){
  const rounds = circleMethod(playerIds);
  const flat = flattenInterleaved(rounds);
  const buckets = distributeMatches(flat, numRounds);
  const matches = [];
  buckets.forEach((bucketMatches, idx) => {
    bucketMatches.forEach(([a, b]) => {
      matches.push({ id: uid(), jornada: idx + 1, playerAId: a, playerBId: b, mapsA: null, mapsB: null });
    });
  });
  return matches;
}
