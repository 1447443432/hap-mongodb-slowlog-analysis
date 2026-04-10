# MongoDB 4.4 Slowlog Guidelines

## What to Extract

For each slow query event, try to extract:

- Namespace: `ns`
- Operation family: `find`, `aggregate`, `count`, `update`, `remove`
- `planSummary`
- `keysExamined`
- `docsExamined`
- `nreturned`
- `durationMillis`
- `hasSortStage`
- Filter fields
- Sort fields
- Projection fields
- Limit or batch size

## How to Read the Main Signals

- `COLLSCAN` in `planSummary` usually means a missing or unusable index.
- Very high `docsExamined` compared with low `nreturned` usually means poor selectivity or poor index shape.
- High `keysExamined` and high `docsExamined` together often mean the query uses an index but still scans too broadly.
- A sort paired with broad scans may indicate the index order does not support both filtering and sorting.
- Low `nreturned` with high `durationMillis` often means the server spent time scanning or sorting rather than returning rows.

## Heuristic for Compound Indexes

Prefer this ordering unless evidence suggests otherwise:

1. Equality filter fields
2. Sort fields
3. Range fields

Do not blindly include every filter field. Exclude low-value fields and fields the project has declared out of scope.

## Project-Specific Constraints

These constraints are mandatory for this skill:

- `ctime` is already indexed.
- Never recommend adding a new index on `ctime`.
- `status` has only two values: `1` and `9`.
- `1` means active/in-use.
- Never include `status` in a recommended index definition because it is low-cardinality and not useful enough for index design here.

When either field appears in the query:

- Mention `ctime` as already indexed when it matters to the explanation.
- Mention `status` as a business filter that should not drive index design.

## Advice Patterns

### If `planSummary` is `COLLSCAN`

- Look for equality filters with meaningful selectivity.
- Propose a compound index using those equality fields and any supported sort fields.
- If the only visible fields are `ctime` and `status`, explicitly avoid recommending a new index from that evidence alone.

### If an Index Exists but the Scan Is Still Large

- Compare the filter shape with the likely current index order.
- Suggest reordering a compound index to match equality predicates first.
- Point out when a sort field probably belongs before a trailing range field.

### If the Query Uses Sort

- Say whether the sort likely benefits from index support.
- Recommend matching sort direction when it matters.
- Avoid recommending a sort-supporting index if the visible filter is too weak or dominated by excluded fields.

### If the Query Returns Too Many Fields

- Suggest narrowing the projection if the log or command payload shows broad document fetch.

### If Pagination Looks Expensive

- Suggest seek-based pagination or tighter predicates instead of deep skip patterns when applicable.

## Confidence Language

Use:

- `High confidence` when filter, sort, and planner evidence are all visible.
- `Medium confidence` when some fields are missing but the planner evidence is still strong.
- `Low confidence` when the snippet is incomplete and only provisional guidance is possible.
