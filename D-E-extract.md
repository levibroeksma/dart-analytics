# Extracted data for D-E - `architecture/08-DartBot.md`

**Used query:**

```sql
SELECT d.intended_target_number,
       d.intended_zone_id,
       d.location_x,
       d.location_y
FROM   darts d
JOIN   turns t        ON t.id = d.turn_id
JOIN   participants p ON p.id = t.participant_id
WHERE  p.participant_type_id = 1
  AND  d.intended_target_number IS NOT NULL
  AND  d.location_x IS NOT NULL;
```

**Result:**

```json
[
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 67.72,
    "location_y": -120.22
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 29.25,
    "location_y": -141.86
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 32.46,
    "location_y": -140.25
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 117.81,
    "location_y": 136.65
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 88.56,
    "location_y": 68.93
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 100.98,
    "location_y": 149.47
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -10.82,
    "location_y": 164.7
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 119.02,
    "location_y": -129.84
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 75.74,
    "location_y": -131.44
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 80.15,
    "location_y": -113.41
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -65.72,
    "location_y": -143.06
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -61.71,
    "location_y": -162.7
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -83.75,
    "location_y": -181.93
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 165.1,
    "location_y": 17.63
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 170.71,
    "location_y": 37.27
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 174.72,
    "location_y": 14.43
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -102.99,
    "location_y": 120.22
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -98.98,
    "location_y": 155.48
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -104.99,
    "location_y": 120.22
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -156.68,
    "location_y": 62.11
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -161.09,
    "location_y": 64.52
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -127.03,
    "location_y": -109.0
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -147.47,
    "location_y": -109.0
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 124.63,
    "location_y": 41.68
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 133.44,
    "location_y": 39.27
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 139.45,
    "location_y": 63.72
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -179.53,
    "location_y": -7.21
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -184.74,
    "location_y": -9.22
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -138.65,
    "location_y": -18.43
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -107.4,
    "location_y": -137.05
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -119.82,
    "location_y": -98.58
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -70.53,
    "location_y": -162.3
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 160.29,
    "location_y": -8.01
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 165.9,
    "location_y": -70.13
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 186.34,
    "location_y": -2.4
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -152.68,
    "location_y": -61.31
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 148.27,
    "location_y": 90.97
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 143.86,
    "location_y": 67.32
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 145.87,
    "location_y": 97.78
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -144.26,
    "location_y": 127.43
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -140.26,
    "location_y": 67.72
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -148.67,
    "location_y": 93.77
  },
  {
    "intended_target_number": 17,
    "intended_zone_id": 2,
    "location_x": 45.28,
    "location_y": 152.28
  },
  {
    "intended_target_number": 17,
    "intended_zone_id": 2,
    "location_x": 26.45,
    "location_y": 145.46
  },
  {
    "intended_target_number": 17,
    "intended_zone_id": 2,
    "location_x": 55.3,
    "location_y": 173.52
  },
  {
    "intended_target_number": 18,
    "intended_zone_id": 2,
    "location_x": 59.71,
    "location_y": -96.17
  },
  {
    "intended_target_number": 18,
    "intended_zone_id": 2,
    "location_x": 74.94,
    "location_y": -132.24
  },
  {
    "intended_target_number": 18,
    "intended_zone_id": 2,
    "location_x": 92.17,
    "location_y": -121.42
  },
  {
    "intended_target_number": 19,
    "intended_zone_id": 2,
    "location_x": -61.71,
    "location_y": 170.31
  },
  {
    "intended_target_number": 19,
    "intended_zone_id": 2,
    "location_x": -85.76,
    "location_y": 129.84
  },
  {
    "intended_target_number": 19,
    "intended_zone_id": 2,
    "location_x": -43.28,
    "location_y": 112.6
  },
  {
    "intended_target_number": 20,
    "intended_zone_id": 2,
    "location_x": -0.8,
    "location_y": -137.85
  },
  {
    "intended_target_number": 20,
    "intended_zone_id": 2,
    "location_x": 14.03,
    "location_y": -140.66
  },
  {
    "intended_target_number": 20,
    "intended_zone_id": 2,
    "location_x": 4.81,
    "location_y": -159.09
  },
  {
    "intended_target_number": 25,
    "intended_zone_id": 5,
    "location_x": -1.6,
    "location_y": -4.41
  },
  {
    "intended_target_number": 25,
    "intended_zone_id": 5,
    "location_x": -21.64,
    "location_y": 35.26
  },
  {
    "intended_target_number": 25,
    "intended_zone_id": 5,
    "location_x": -8.01,
    "location_y": 23.64
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 53.11,
    "location_y": -158.07
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 42.26,
    "location_y": -123.8
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 0.0,
    "location_y": -163.78
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 56.54,
    "location_y": -140.37
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 20.56,
    "location_y": -100.39
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 30.27,
    "location_y": -89.54
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 55.97,
    "location_y": 140.05
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 103.94,
    "location_y": 166.32
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 118.79,
    "location_y": 116.06
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 2.86,
    "location_y": 129.19
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 0.0,
    "location_y": 133.76
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 14.85,
    "location_y": 146.9
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 133.64,
    "location_y": -98.68
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 149.06,
    "location_y": -61.55
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 134.78,
    "location_y": -103.24
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -66.25,
    "location_y": -161.5
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -63.96,
    "location_y": -154.64
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 186.75,
    "location_y": -27.29
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 175.9,
    "location_y": 1.84
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 168.48,
    "location_y": 58.95
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -105.65,
    "location_y": 144.04
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -134.21,
    "location_y": 94.93
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -176.47,
    "location_y": 56.09
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -156.48,
    "location_y": 61.23
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -173.04,
    "location_y": -68.98
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -99.94,
    "location_y": -68.98
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -100.51,
    "location_y": -76.4
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 172.47,
    "location_y": 54.38
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 165.05,
    "location_y": 34.96
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 173.62,
    "location_y": 61.8
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -165.62,
    "location_y": 5.84
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -186.18,
    "location_y": 19.54
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -145.63,
    "location_y": -13.58
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -109.08,
    "location_y": -125.52
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -98.23,
    "location_y": -164.92
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -114.79,
    "location_y": -73.55
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 138.78,
    "location_y": 28.11
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 137.64,
    "location_y": -39.28
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 127.36,
    "location_y": -44.42
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -168.48,
    "location_y": -44.99
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -150.77,
    "location_y": -43.85
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -121.65,
    "location_y": -40.42
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 127.36,
    "location_y": 68.09
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 92.52,
    "location_y": 122.34
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 127.36,
    "location_y": 118.34
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 43.51,
    "location_y": -184.8
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 46.44,
    "location_y": -122.71
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 45.96,
    "location_y": -114.4
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -139.92,
    "location_y": 93.21
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -130.21,
    "location_y": 88.07
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -171.33,
    "location_y": 106.35
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -112.51,
    "location_y": 134.33
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -117.65,
    "location_y": 88.65
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -132.5,
    "location_y": 126.34
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 33.73,
    "location_y": -105.11
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 42.53,
    "location_y": -159.87
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 62.58,
    "location_y": -138.36
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 58.18,
    "location_y": -137.38
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 55.24,
    "location_y": -164.76
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 41.07,
    "location_y": -112.44
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 53.29,
    "location_y": 158.89
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 76.27,
    "location_y": 106.09
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 82.62,
    "location_y": 105.6
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 20.04,
    "location_y": 212.18
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -4.89,
    "location_y": 242.0
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -6.84,
    "location_y": 175.51
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 164.76,
    "location_y": -78.71
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 111.47,
    "location_y": -102.67
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 117.82,
    "location_y": -98.27
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -76.27,
    "location_y": -175.02
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -77.24,
    "location_y": -157.42
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -23.96,
    "location_y": -83.6
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 55.4,
    "location_y": -130.09
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 37.69,
    "location_y": -192.34
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 93.66,
    "location_y": -98.68
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 93.09,
    "location_y": 105.21
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 114.79,
    "location_y": 137.19
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 121.65,
    "location_y": 134.91
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -10.28,
    "location_y": 154.89
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 15.42,
    "location_y": 145.76
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -18.28,
    "location_y": 149.75
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 139.35,
    "location_y": -75.83
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 98.8,
    "location_y": -88.97
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 101.66,
    "location_y": -114.67
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -103.37,
    "location_y": -117.52
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -93.66,
    "location_y": -148.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -62.82,
    "location_y": -155.22
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 135.35,
    "location_y": 27.54
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 145.06,
    "location_y": 9.26
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 153.06,
    "location_y": 41.24
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -105.65,
    "location_y": 70.94
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -94.8,
    "location_y": 60.66
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -103.37,
    "location_y": 88.07
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 59.97,
    "location_y": -180.92
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 57.11,
    "location_y": -141.51
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 35.41,
    "location_y": -129.52
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 118.79,
    "location_y": 114.35
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 98.8,
    "location_y": 77.8
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 65.68,
    "location_y": 113.2
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -47.4,
    "location_y": 128.05
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 6.28,
    "location_y": 132.62
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -4.57,
    "location_y": 184.02
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 127.93,
    "location_y": -84.4
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 130.21,
    "location_y": -88.4
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 168.48,
    "location_y": -57.56
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -67.96,
    "location_y": -152.36
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 178.18,
    "location_y": -15.29
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 138.78,
    "location_y": 17.83
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 127.93,
    "location_y": 9.26
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -98.8,
    "location_y": 124.63
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -53.68,
    "location_y": 173.17
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -120.5,
    "location_y": 141.19
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -166.19,
    "location_y": 73.23
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -157.05,
    "location_y": 70.94
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -134.78,
    "location_y": 82.94
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -105.08,
    "location_y": -127.8
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -160.48,
    "location_y": -90.11
  },
  {
    "intended_target_number": 9,
    "intended_zone_id": 2,
    "location_x": -147.92,
    "location_y": -93.54
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 148.49,
    "location_y": 96.07
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 124.5,
    "location_y": 110.92
  },
  {
    "intended_target_number": 10,
    "intended_zone_id": 2,
    "location_x": 177.04,
    "location_y": 70.37
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -171.33,
    "location_y": -25.57
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -178.18,
    "location_y": -40.99
  },
  {
    "intended_target_number": 11,
    "intended_zone_id": 2,
    "location_x": -185.61,
    "location_y": -7.87
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -99.37,
    "location_y": -135.8
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -83.95,
    "location_y": -158.64
  },
  {
    "intended_target_number": 12,
    "intended_zone_id": 2,
    "location_x": -119.36,
    "location_y": -152.93
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 132.5,
    "location_y": -61.55
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 132.5,
    "location_y": -78.12
  },
  {
    "intended_target_number": 13,
    "intended_zone_id": 2,
    "location_x": 168.48,
    "location_y": -54.7
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -143.35,
    "location_y": -34.14
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -170.76,
    "location_y": -38.14
  },
  {
    "intended_target_number": 14,
    "intended_zone_id": 2,
    "location_x": -165.05,
    "location_y": 0.12
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 132.5,
    "location_y": 83.51
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 131.93,
    "location_y": 125.2
  },
  {
    "intended_target_number": 15,
    "intended_zone_id": 2,
    "location_x": 93.09,
    "location_y": 114.35
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -159.91,
    "location_y": 77.8
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -138.21,
    "location_y": 74.94
  },
  {
    "intended_target_number": 16,
    "intended_zone_id": 2,
    "location_x": -109.65,
    "location_y": 68.66
  },
  {
    "intended_target_number": 17,
    "intended_zone_id": 2,
    "location_x": 30.84,
    "location_y": 152.61
  },
  {
    "intended_target_number": 17,
    "intended_zone_id": 2,
    "location_x": 37.12,
    "location_y": 177.74
  },
  {
    "intended_target_number": 17,
    "intended_zone_id": 2,
    "location_x": 77.1,
    "location_y": 259.98
  },
  {
    "intended_target_number": 18,
    "intended_zone_id": 2,
    "location_x": 97.66,
    "location_y": -166.64
  },
  {
    "intended_target_number": 18,
    "intended_zone_id": 2,
    "location_x": 79.38,
    "location_y": -134.08
  },
  {
    "intended_target_number": 18,
    "intended_zone_id": 2,
    "location_x": 70.82,
    "location_y": -169.49
  },
  {
    "intended_target_number": 19,
    "intended_zone_id": 2,
    "location_x": -39.98,
    "location_y": 149.18
  },
  {
    "intended_target_number": 19,
    "intended_zone_id": 2,
    "location_x": -68.53,
    "location_y": 180.02
  },
  {
    "intended_target_number": 19,
    "intended_zone_id": 2,
    "location_x": -95.37,
    "location_y": 172.6
  },
  {
    "intended_target_number": 20,
    "intended_zone_id": 2,
    "location_x": -4.0,
    "location_y": -137.51
  },
  {
    "intended_target_number": 20,
    "intended_zone_id": 2,
    "location_x": -0.57,
    "location_y": -180.34
  },
  {
    "intended_target_number": 20,
    "intended_zone_id": 2,
    "location_x": 6.28,
    "location_y": -143.79
  },
  {
    "intended_target_number": 25,
    "intended_zone_id": 5,
    "location_x": 33.7,
    "location_y": 36.1
  },
  {
    "intended_target_number": 25,
    "intended_zone_id": 5,
    "location_x": 8.57,
    "location_y": -11.87
  },
  {
    "intended_target_number": 25,
    "intended_zone_id": 5,
    "location_x": -6.85,
    "location_y": -23.86
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 76.53,
    "location_y": -145.51
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 18.85,
    "location_y": -149.5
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 26.84,
    "location_y": -145.51
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 118.79,
    "location_y": 69.23
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 83.38,
    "location_y": 143.47
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 106.23,
    "location_y": 166.32
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -29.13,
    "location_y": 166.32
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 17.13,
    "location_y": 213.15
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 3.43,
    "location_y": 173.74
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 156.48,
    "location_y": -53.56
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 136.49,
    "location_y": -124.95
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 95.37,
    "location_y": -146.08
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -51.97,
    "location_y": -166.64
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -49.11,
    "location_y": -170.06
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -82.81,
    "location_y": -176.92
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 174.19,
    "location_y": -18.15
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 196.46,
    "location_y": -65.55
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 151.91,
    "location_y": -15.29
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 32.55,
    "location_y": -148.36
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 42.83,
    "location_y": -130.09
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 17.13,
    "location_y": -146.65
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 137.64,
    "location_y": 120.63
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 103.94,
    "location_y": 121.2
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 98.23,
    "location_y": 125.77
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 4.57,
    "location_y": 145.19
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 14.85,
    "location_y": 174.88
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -16.56,
    "location_y": 177.17
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 141.63,
    "location_y": -83.26
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 153.06,
    "location_y": -101.53
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 87.38,
    "location_y": -103.24
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -62.82,
    "location_y": -175.2
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -50.83,
    "location_y": -156.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -89.09,
    "location_y": -156.36
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 172.47,
    "location_y": 29.82
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 172.47,
    "location_y": 46.38
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 131.93,
    "location_y": 5.26
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -103.94,
    "location_y": 116.06
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -71.39,
    "location_y": 90.93
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -86.24,
    "location_y": 119.49
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -177.61,
    "location_y": -12.44
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -149.06,
    "location_y": 45.81
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -169.62,
    "location_y": 44.67
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 17.13,
    "location_y": -138.08
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 69.67,
    "location_y": -139.8
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 15.42,
    "location_y": -166.64
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 79.95,
    "location_y": 125.2
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 69.1,
    "location_y": 153.75
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 91.95,
    "location_y": 154.32
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -11.99,
    "location_y": 184.02
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -21.7,
    "location_y": 115.49
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 6.28,
    "location_y": 145.76
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 118.79,
    "location_y": -124.38
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 131.93,
    "location_y": -98.11
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 115.93,
    "location_y": -119.24
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -70.82,
    "location_y": -160.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -52.54,
    "location_y": -156.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -55.4,
    "location_y": -122.66
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 175.33,
    "location_y": 29.82
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 157.05,
    "location_y": -16.44
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 170.19,
    "location_y": 30.96
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -28.56,
    "location_y": 136.05
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -46.26,
    "location_y": 148.61
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -62.25,
    "location_y": 158.32
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -172.47,
    "location_y": 55.52
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -143.92,
    "location_y": 5.84
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -144.49,
    "location_y": 96.07
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 49.11,
    "location_y": -181.49
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 76.53,
    "location_y": -146.08
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 63.96,
    "location_y": -145.51
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 78.81,
    "location_y": 119.49
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 93.09,
    "location_y": 150.33
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 109.08,
    "location_y": 149.18
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -8.0,
    "location_y": 131.48
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -0.57,
    "location_y": 136.62
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 6.28,
    "location_y": 150.9
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 134.21,
    "location_y": -132.37
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 135.92,
    "location_y": -96.39
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 142.2,
    "location_y": -86.11
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -62.82,
    "location_y": -134.66
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -14.85,
    "location_y": -132.94
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -63.39,
    "location_y": -141.51
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 178.76,
    "location_y": 12.12
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 160.48,
    "location_y": 18.4
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 138.78,
    "location_y": -34.14
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -119.36,
    "location_y": 157.18
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -104.51,
    "location_y": 138.9
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -102.23,
    "location_y": 147.47
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 71.39,
    "location_y": -164.35
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 45.69,
    "location_y": -134.66
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 67.39,
    "location_y": -165.5
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 78.81,
    "location_y": 129.77
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 93.66,
    "location_y": 152.04
  },
  {
    "intended_target_number": 2,
    "intended_zone_id": 2,
    "location_x": 96.52,
    "location_y": 151.47
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": 4.0,
    "location_y": 103.49
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -26.84,
    "location_y": 118.34
  },
  {
    "intended_target_number": 3,
    "intended_zone_id": 2,
    "location_x": -9.71,
    "location_y": 134.33
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 141.01,
    "location_y": -124.77
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 137.4,
    "location_y": -111.39
  },
  {
    "intended_target_number": 4,
    "intended_zone_id": 2,
    "location_x": 149.75,
    "location_y": -90.81
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -90.06,
    "location_y": -175.2
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -37.57,
    "location_y": -161.31
  },
  {
    "intended_target_number": 5,
    "intended_zone_id": 2,
    "location_x": -72.05,
    "location_y": -148.44
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 133.8,
    "location_y": 18.29
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 141.52,
    "location_y": 27.04
  },
  {
    "intended_target_number": 6,
    "intended_zone_id": 2,
    "location_x": 126.08,
    "location_y": 26.53
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -129.68,
    "location_y": 149.01
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -85.43,
    "location_y": 135.11
  },
  {
    "intended_target_number": 7,
    "intended_zone_id": 2,
    "location_x": -120.94,
    "location_y": 144.38
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -155.42,
    "location_y": 80.05
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -120.42,
    "location_y": 15.72
  },
  {
    "intended_target_number": 8,
    "intended_zone_id": 2,
    "location_x": -142.55,
    "location_y": 85.71
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 44.49,
    "location_y": -172.58
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 46.93,
    "location_y": -143.73
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 40.09,
    "location_y": -154.0
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 36.18,
    "location_y": -90.93
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 23.96,
    "location_y": -81.64
  },
  {
    "intended_target_number": 1,
    "intended_zone_id": 2,
    "location_x": 50.36,
    "location_y": -144.22
  }
]
```

## `missMargin()` query result

**Used query:**

```sql
SELECT d.intended_target_number,
       dz.implementation_key AS intended_zone_key,
       d.location_x,
       d.location_y
FROM   darts d
JOIN   turns t         ON t.id = d.turn_id
JOIN   participants p  ON p.id = t.participant_id
JOIN   dart_zones dz   ON dz.id = d.intended_zone_id
WHERE  p.participant_type_id = 1
  AND  d.intended_target_number IS NOT NULL
  AND  d.intended_zone_id IS NOT NULL
  AND  d.location_x IS NOT NULL
  AND  d.location_y IS NOT NULL;
```

**Result:**

```json
[
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 67.72,
    "location_y": -120.22
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 29.25,
    "location_y": -141.86
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 32.46,
    "location_y": -140.25
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 117.81,
    "location_y": 136.65
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 88.56,
    "location_y": 68.93
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 100.98,
    "location_y": 149.47
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -10.82,
    "location_y": 164.7
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 119.02,
    "location_y": -129.84
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 75.74,
    "location_y": -131.44
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 80.15,
    "location_y": -113.41
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -65.72,
    "location_y": -143.06
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -61.71,
    "location_y": -162.7
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -83.75,
    "location_y": -181.93
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 165.1,
    "location_y": 17.63
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 170.71,
    "location_y": 37.27
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 174.72,
    "location_y": 14.43
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -102.99,
    "location_y": 120.22
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -98.98,
    "location_y": 155.48
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -104.99,
    "location_y": 120.22
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -156.68,
    "location_y": 62.11
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -161.09,
    "location_y": 64.52
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -127.03,
    "location_y": -109.0
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -147.47,
    "location_y": -109.0
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 124.63,
    "location_y": 41.68
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 133.44,
    "location_y": 39.27
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 139.45,
    "location_y": 63.72
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -179.53,
    "location_y": -7.21
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -184.74,
    "location_y": -9.22
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -138.65,
    "location_y": -18.43
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -107.4,
    "location_y": -137.05
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -119.82,
    "location_y": -98.58
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -70.53,
    "location_y": -162.3
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 160.29,
    "location_y": -8.01
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 165.9,
    "location_y": -70.13
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 186.34,
    "location_y": -2.4
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -152.68,
    "location_y": -61.31
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 148.27,
    "location_y": 90.97
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 143.86,
    "location_y": 67.32
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 145.87,
    "location_y": 97.78
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -144.26,
    "location_y": 127.43
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -140.26,
    "location_y": 67.72
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -148.67,
    "location_y": 93.77
  },
  {
    "intended_target_number": 17,
    "intended_zone_key": "DOUBLE",
    "location_x": 45.28,
    "location_y": 152.28
  },
  {
    "intended_target_number": 17,
    "intended_zone_key": "DOUBLE",
    "location_x": 26.45,
    "location_y": 145.46
  },
  {
    "intended_target_number": 17,
    "intended_zone_key": "DOUBLE",
    "location_x": 55.3,
    "location_y": 173.52
  },
  {
    "intended_target_number": 18,
    "intended_zone_key": "DOUBLE",
    "location_x": 59.71,
    "location_y": -96.17
  },
  {
    "intended_target_number": 18,
    "intended_zone_key": "DOUBLE",
    "location_x": 74.94,
    "location_y": -132.24
  },
  {
    "intended_target_number": 18,
    "intended_zone_key": "DOUBLE",
    "location_x": 92.17,
    "location_y": -121.42
  },
  {
    "intended_target_number": 19,
    "intended_zone_key": "DOUBLE",
    "location_x": -61.71,
    "location_y": 170.31
  },
  {
    "intended_target_number": 19,
    "intended_zone_key": "DOUBLE",
    "location_x": -85.76,
    "location_y": 129.84
  },
  {
    "intended_target_number": 19,
    "intended_zone_key": "DOUBLE",
    "location_x": -43.28,
    "location_y": 112.6
  },
  {
    "intended_target_number": 20,
    "intended_zone_key": "DOUBLE",
    "location_x": -0.8,
    "location_y": -137.85
  },
  {
    "intended_target_number": 20,
    "intended_zone_key": "DOUBLE",
    "location_x": 14.03,
    "location_y": -140.66
  },
  {
    "intended_target_number": 20,
    "intended_zone_key": "DOUBLE",
    "location_x": 4.81,
    "location_y": -159.09
  },
  {
    "intended_target_number": 25,
    "intended_zone_key": "INNER_BULL",
    "location_x": -1.6,
    "location_y": -4.41
  },
  {
    "intended_target_number": 25,
    "intended_zone_key": "INNER_BULL",
    "location_x": -21.64,
    "location_y": 35.26
  },
  {
    "intended_target_number": 25,
    "intended_zone_key": "INNER_BULL",
    "location_x": -8.01,
    "location_y": 23.64
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 53.11,
    "location_y": -158.07
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 42.26,
    "location_y": -123.8
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 0.0,
    "location_y": -163.78
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 56.54,
    "location_y": -140.37
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 20.56,
    "location_y": -100.39
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 30.27,
    "location_y": -89.54
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 55.97,
    "location_y": 140.05
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 103.94,
    "location_y": 166.32
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 118.79,
    "location_y": 116.06
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 2.86,
    "location_y": 129.19
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 0.0,
    "location_y": 133.76
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 14.85,
    "location_y": 146.9
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 133.64,
    "location_y": -98.68
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 149.06,
    "location_y": -61.55
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 134.78,
    "location_y": -103.24
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -66.25,
    "location_y": -161.5
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -63.96,
    "location_y": -154.64
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 186.75,
    "location_y": -27.29
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 175.9,
    "location_y": 1.84
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 168.48,
    "location_y": 58.95
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -105.65,
    "location_y": 144.04
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -134.21,
    "location_y": 94.93
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -176.47,
    "location_y": 56.09
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -156.48,
    "location_y": 61.23
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -173.04,
    "location_y": -68.98
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -99.94,
    "location_y": -68.98
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -100.51,
    "location_y": -76.4
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 172.47,
    "location_y": 54.38
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 165.05,
    "location_y": 34.96
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 173.62,
    "location_y": 61.8
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -165.62,
    "location_y": 5.84
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -186.18,
    "location_y": 19.54
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -145.63,
    "location_y": -13.58
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -109.08,
    "location_y": -125.52
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -98.23,
    "location_y": -164.92
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -114.79,
    "location_y": -73.55
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 138.78,
    "location_y": 28.11
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 137.64,
    "location_y": -39.28
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 127.36,
    "location_y": -44.42
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -168.48,
    "location_y": -44.99
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -150.77,
    "location_y": -43.85
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -121.65,
    "location_y": -40.42
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 127.36,
    "location_y": 68.09
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 92.52,
    "location_y": 122.34
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 127.36,
    "location_y": 118.34
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 43.51,
    "location_y": -184.8
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 46.44,
    "location_y": -122.71
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 45.96,
    "location_y": -114.4
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -139.92,
    "location_y": 93.21
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -130.21,
    "location_y": 88.07
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -171.33,
    "location_y": 106.35
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -112.51,
    "location_y": 134.33
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -117.65,
    "location_y": 88.65
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -132.5,
    "location_y": 126.34
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 33.73,
    "location_y": -105.11
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 42.53,
    "location_y": -159.87
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 62.58,
    "location_y": -138.36
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 58.18,
    "location_y": -137.38
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 55.24,
    "location_y": -164.76
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 41.07,
    "location_y": -112.44
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 53.29,
    "location_y": 158.89
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 76.27,
    "location_y": 106.09
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 82.62,
    "location_y": 105.6
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 20.04,
    "location_y": 212.18
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -4.89,
    "location_y": 242.0
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -6.84,
    "location_y": 175.51
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 164.76,
    "location_y": -78.71
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 111.47,
    "location_y": -102.67
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 117.82,
    "location_y": -98.27
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -76.27,
    "location_y": -175.02
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -77.24,
    "location_y": -157.42
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -23.96,
    "location_y": -83.6
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 55.4,
    "location_y": -130.09
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 37.69,
    "location_y": -192.34
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 93.66,
    "location_y": -98.68
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 93.09,
    "location_y": 105.21
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 114.79,
    "location_y": 137.19
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 121.65,
    "location_y": 134.91
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -10.28,
    "location_y": 154.89
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 15.42,
    "location_y": 145.76
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -18.28,
    "location_y": 149.75
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 139.35,
    "location_y": -75.83
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 98.8,
    "location_y": -88.97
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 101.66,
    "location_y": -114.67
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -103.37,
    "location_y": -117.52
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -93.66,
    "location_y": -148.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -62.82,
    "location_y": -155.22
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 135.35,
    "location_y": 27.54
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 145.06,
    "location_y": 9.26
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 153.06,
    "location_y": 41.24
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -105.65,
    "location_y": 70.94
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -94.8,
    "location_y": 60.66
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -103.37,
    "location_y": 88.07
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 59.97,
    "location_y": -180.92
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 57.11,
    "location_y": -141.51
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 35.41,
    "location_y": -129.52
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 118.79,
    "location_y": 114.35
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 98.8,
    "location_y": 77.8
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 65.68,
    "location_y": 113.2
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -47.4,
    "location_y": 128.05
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 6.28,
    "location_y": 132.62
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -4.57,
    "location_y": 184.02
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 127.93,
    "location_y": -84.4
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 130.21,
    "location_y": -88.4
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 168.48,
    "location_y": -57.56
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -67.96,
    "location_y": -152.36
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 178.18,
    "location_y": -15.29
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 138.78,
    "location_y": 17.83
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 127.93,
    "location_y": 9.26
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -98.8,
    "location_y": 124.63
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -53.68,
    "location_y": 173.17
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -120.5,
    "location_y": 141.19
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -166.19,
    "location_y": 73.23
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -157.05,
    "location_y": 70.94
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -134.78,
    "location_y": 82.94
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -105.08,
    "location_y": -127.8
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -160.48,
    "location_y": -90.11
  },
  {
    "intended_target_number": 9,
    "intended_zone_key": "DOUBLE",
    "location_x": -147.92,
    "location_y": -93.54
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 148.49,
    "location_y": 96.07
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 124.5,
    "location_y": 110.92
  },
  {
    "intended_target_number": 10,
    "intended_zone_key": "DOUBLE",
    "location_x": 177.04,
    "location_y": 70.37
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -171.33,
    "location_y": -25.57
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -178.18,
    "location_y": -40.99
  },
  {
    "intended_target_number": 11,
    "intended_zone_key": "DOUBLE",
    "location_x": -185.61,
    "location_y": -7.87
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -99.37,
    "location_y": -135.8
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -83.95,
    "location_y": -158.64
  },
  {
    "intended_target_number": 12,
    "intended_zone_key": "DOUBLE",
    "location_x": -119.36,
    "location_y": -152.93
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 132.5,
    "location_y": -61.55
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 132.5,
    "location_y": -78.12
  },
  {
    "intended_target_number": 13,
    "intended_zone_key": "DOUBLE",
    "location_x": 168.48,
    "location_y": -54.7
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -143.35,
    "location_y": -34.14
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -170.76,
    "location_y": -38.14
  },
  {
    "intended_target_number": 14,
    "intended_zone_key": "DOUBLE",
    "location_x": -165.05,
    "location_y": 0.12
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 132.5,
    "location_y": 83.51
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 131.93,
    "location_y": 125.2
  },
  {
    "intended_target_number": 15,
    "intended_zone_key": "DOUBLE",
    "location_x": 93.09,
    "location_y": 114.35
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -159.91,
    "location_y": 77.8
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -138.21,
    "location_y": 74.94
  },
  {
    "intended_target_number": 16,
    "intended_zone_key": "DOUBLE",
    "location_x": -109.65,
    "location_y": 68.66
  },
  {
    "intended_target_number": 17,
    "intended_zone_key": "DOUBLE",
    "location_x": 30.84,
    "location_y": 152.61
  },
  {
    "intended_target_number": 17,
    "intended_zone_key": "DOUBLE",
    "location_x": 37.12,
    "location_y": 177.74
  },
  {
    "intended_target_number": 17,
    "intended_zone_key": "DOUBLE",
    "location_x": 77.1,
    "location_y": 259.98
  },
  {
    "intended_target_number": 18,
    "intended_zone_key": "DOUBLE",
    "location_x": 97.66,
    "location_y": -166.64
  },
  {
    "intended_target_number": 18,
    "intended_zone_key": "DOUBLE",
    "location_x": 79.38,
    "location_y": -134.08
  },
  {
    "intended_target_number": 18,
    "intended_zone_key": "DOUBLE",
    "location_x": 70.82,
    "location_y": -169.49
  },
  {
    "intended_target_number": 19,
    "intended_zone_key": "DOUBLE",
    "location_x": -39.98,
    "location_y": 149.18
  },
  {
    "intended_target_number": 19,
    "intended_zone_key": "DOUBLE",
    "location_x": -68.53,
    "location_y": 180.02
  },
  {
    "intended_target_number": 19,
    "intended_zone_key": "DOUBLE",
    "location_x": -95.37,
    "location_y": 172.6
  },
  {
    "intended_target_number": 20,
    "intended_zone_key": "DOUBLE",
    "location_x": -4.0,
    "location_y": -137.51
  },
  {
    "intended_target_number": 20,
    "intended_zone_key": "DOUBLE",
    "location_x": -0.57,
    "location_y": -180.34
  },
  {
    "intended_target_number": 20,
    "intended_zone_key": "DOUBLE",
    "location_x": 6.28,
    "location_y": -143.79
  },
  {
    "intended_target_number": 25,
    "intended_zone_key": "INNER_BULL",
    "location_x": 33.7,
    "location_y": 36.1
  },
  {
    "intended_target_number": 25,
    "intended_zone_key": "INNER_BULL",
    "location_x": 8.57,
    "location_y": -11.87
  },
  {
    "intended_target_number": 25,
    "intended_zone_key": "INNER_BULL",
    "location_x": -6.85,
    "location_y": -23.86
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 76.53,
    "location_y": -145.51
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 18.85,
    "location_y": -149.5
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 26.84,
    "location_y": -145.51
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 118.79,
    "location_y": 69.23
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 83.38,
    "location_y": 143.47
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 106.23,
    "location_y": 166.32
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -29.13,
    "location_y": 166.32
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 17.13,
    "location_y": 213.15
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 3.43,
    "location_y": 173.74
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 156.48,
    "location_y": -53.56
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 136.49,
    "location_y": -124.95
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 95.37,
    "location_y": -146.08
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -51.97,
    "location_y": -166.64
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -49.11,
    "location_y": -170.06
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -82.81,
    "location_y": -176.92
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 174.19,
    "location_y": -18.15
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 196.46,
    "location_y": -65.55
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 151.91,
    "location_y": -15.29
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 32.55,
    "location_y": -148.36
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 42.83,
    "location_y": -130.09
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 17.13,
    "location_y": -146.65
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 137.64,
    "location_y": 120.63
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 103.94,
    "location_y": 121.2
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 98.23,
    "location_y": 125.77
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 4.57,
    "location_y": 145.19
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 14.85,
    "location_y": 174.88
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -16.56,
    "location_y": 177.17
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 141.63,
    "location_y": -83.26
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 153.06,
    "location_y": -101.53
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 87.38,
    "location_y": -103.24
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -62.82,
    "location_y": -175.2
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -50.83,
    "location_y": -156.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -89.09,
    "location_y": -156.36
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 172.47,
    "location_y": 29.82
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 172.47,
    "location_y": 46.38
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 131.93,
    "location_y": 5.26
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -103.94,
    "location_y": 116.06
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -71.39,
    "location_y": 90.93
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -86.24,
    "location_y": 119.49
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -177.61,
    "location_y": -12.44
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -149.06,
    "location_y": 45.81
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -169.62,
    "location_y": 44.67
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 17.13,
    "location_y": -138.08
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 69.67,
    "location_y": -139.8
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 15.42,
    "location_y": -166.64
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 79.95,
    "location_y": 125.2
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 69.1,
    "location_y": 153.75
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 91.95,
    "location_y": 154.32
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -11.99,
    "location_y": 184.02
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -21.7,
    "location_y": 115.49
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 6.28,
    "location_y": 145.76
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 118.79,
    "location_y": -124.38
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 131.93,
    "location_y": -98.11
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 115.93,
    "location_y": -119.24
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -70.82,
    "location_y": -160.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -52.54,
    "location_y": -156.36
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -55.4,
    "location_y": -122.66
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 175.33,
    "location_y": 29.82
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 157.05,
    "location_y": -16.44
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 170.19,
    "location_y": 30.96
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -28.56,
    "location_y": 136.05
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -46.26,
    "location_y": 148.61
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -62.25,
    "location_y": 158.32
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -172.47,
    "location_y": 55.52
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -143.92,
    "location_y": 5.84
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -144.49,
    "location_y": 96.07
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 49.11,
    "location_y": -181.49
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 76.53,
    "location_y": -146.08
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 63.96,
    "location_y": -145.51
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 78.81,
    "location_y": 119.49
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 93.09,
    "location_y": 150.33
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 109.08,
    "location_y": 149.18
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -8.0,
    "location_y": 131.48
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -0.57,
    "location_y": 136.62
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 6.28,
    "location_y": 150.9
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 134.21,
    "location_y": -132.37
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 135.92,
    "location_y": -96.39
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 142.2,
    "location_y": -86.11
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -62.82,
    "location_y": -134.66
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -14.85,
    "location_y": -132.94
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -63.39,
    "location_y": -141.51
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 178.76,
    "location_y": 12.12
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 160.48,
    "location_y": 18.4
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 138.78,
    "location_y": -34.14
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -119.36,
    "location_y": 157.18
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -104.51,
    "location_y": 138.9
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -102.23,
    "location_y": 147.47
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 71.39,
    "location_y": -164.35
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 45.69,
    "location_y": -134.66
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 67.39,
    "location_y": -165.5
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 78.81,
    "location_y": 129.77
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 93.66,
    "location_y": 152.04
  },
  {
    "intended_target_number": 2,
    "intended_zone_key": "DOUBLE",
    "location_x": 96.52,
    "location_y": 151.47
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": 4.0,
    "location_y": 103.49
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -26.84,
    "location_y": 118.34
  },
  {
    "intended_target_number": 3,
    "intended_zone_key": "DOUBLE",
    "location_x": -9.71,
    "location_y": 134.33
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 141.01,
    "location_y": -124.77
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 137.4,
    "location_y": -111.39
  },
  {
    "intended_target_number": 4,
    "intended_zone_key": "DOUBLE",
    "location_x": 149.75,
    "location_y": -90.81
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -90.06,
    "location_y": -175.2
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -37.57,
    "location_y": -161.31
  },
  {
    "intended_target_number": 5,
    "intended_zone_key": "DOUBLE",
    "location_x": -72.05,
    "location_y": -148.44
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 133.8,
    "location_y": 18.29
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 141.52,
    "location_y": 27.04
  },
  {
    "intended_target_number": 6,
    "intended_zone_key": "DOUBLE",
    "location_x": 126.08,
    "location_y": 26.53
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -129.68,
    "location_y": 149.01
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -85.43,
    "location_y": 135.11
  },
  {
    "intended_target_number": 7,
    "intended_zone_key": "DOUBLE",
    "location_x": -120.94,
    "location_y": 144.38
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -155.42,
    "location_y": 80.05
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -120.42,
    "location_y": 15.72
  },
  {
    "intended_target_number": 8,
    "intended_zone_key": "DOUBLE",
    "location_x": -142.55,
    "location_y": 85.71
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 44.49,
    "location_y": -172.58
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 46.93,
    "location_y": -143.73
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 40.09,
    "location_y": -154.0
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 36.18,
    "location_y": -90.93
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 23.96,
    "location_y": -81.64
  },
  {
    "intended_target_number": 1,
    "intended_zone_key": "DOUBLE",
    "location_x": 50.36,
    "location_y": -144.22
  }
]
```
