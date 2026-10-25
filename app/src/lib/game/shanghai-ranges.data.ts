/** The round-range presets the setup form offers; the schema accepts any `range_start <= range_end` slice of 1..20. */
export const SHANGHAI_RANGES = [
  { value: "1-20", label: "1–20", rangeStart: 1, rangeEnd: 20 },
  { value: "1-10", label: "1–10", rangeStart: 1, rangeEnd: 10 },
  { value: "1-7", label: "1–7", rangeStart: 1, rangeEnd: 7 },
  { value: "11-20", label: "11–20", rangeStart: 11, rangeEnd: 20 },
  { value: "13-20", label: "13–20", rangeStart: 13, rangeEnd: 20 },
] as const;
