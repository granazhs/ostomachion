# Forced Pairs I+L, J+M, K+N

## Empirical fact

Across all **1544** raw solutions in `solutions.json`, the pairs `I+L`, `J+M`,
and `K+N` co-occur in **every** solution, and within each pair the two pieces
always share an edge:

- `I+L`: 1544 / 1544 co-occur, 1544 / 1544 share an edge
- `J+M`: 1544 / 1544 co-occur, 1544 / 1544 share an edge
- `K+N`: 1544 / 1544 co-occur, 1544 / 1544 share an edge

## Root cause

In an edge-to-edge dissection, an edge of a piece can only be matched by
edges of equal length along the same line. A forced pairing arises when a
piece has an edge whose length *and* primitive direction are unique to
exactly two pieces — leaving no alternative matching.

The three forced pairs have exactly this property. Each pair owns a distinct
edge length whose primitive direction occurs in no other piece at all:

| pair | shared edge length | primitive direction | unique owners |
|------|--------------------|--------------------:|---------------|
| I, L | √13 ≈ 3.6056 | (3,−2) / (−3,2) | I, L |
| J, M | √104 ≈ 10.1980 | (−1,−5) / (1,5) | J, M |
| K, N | √17 ≈ 4.1231 | (1,−4) / (−1,4) | K, N |

Because the direction carries only that one length in the whole piece set,
the edge cannot be subdivided into a chain of collinear segments from other
pieces — it must be matched edge-to-edge against the single other piece that
owns it.

### Contrast: B and F are *not* forced

`B` and `F` each have an edge of length 4√2 ≈ 5.6569 along direction (1,1).
Length alone would suggest a forced pairing, but direction (1,1) is shared by
many other edges (2√2 across C, D, E, H, J, M; 4√2 across A, B, F, …), so a
4√2 edge can be subdivided into smaller collinear segments. No pairing is
forced, and indeed B and F are not always adjacent.

## Composite shapes

Since each pair is always joined along its forced edge, the two pieces behave
as a single rigid composite. Merging collinear edges and translating to the
origin gives (classic → simple naming):

| composite | vertices | area |
|-----------|----------|-----:|
| I+L → I | `[[0,3],[6,0],[6,6],[0,6]]` | 27 |
| J+M → J | `[[0,0],[12,0],[4,4]]` | 24 |
| K+N → K | `[[0,0],[6,3],[0,3]]` | 9 |

Areas confirm the union: I+L = area(I) 12 + area(L) 15 = 27; J+M = 12 + 12 =
24; K+N = 5 + 4 = 9.

## The "simple" configuration

Replacing the three forced pairs by their composites yields an 11-piece set
`A`–`K` (total area 144):

| piece | area |
|-------|-----:|
| A | 12 |
| B | 12 |
| C | 12 |
| D | 6 |
| E | 6 |
| F | 6 |
| G | 9 |
| H | 21 |
| I (I+L) | 27 |
| J (J+M) | 24 |
| K (K+N) | 9 |

Note the composite K is congruent to G (both are the {6, 6.708, 3} right
triangle), so the simple set has three congruent pairs: A/B, D/E, and G/K.
