# Seaglider science-sensor audit (sg_calib_constants.m vs OGDB)

Generated read-only against the local `ogdb-test` sandbox. Nothing was written.

## 1. Builds that already existed - discrepancies

| Mission | Glider | Type | File says | OGDB build has | Verdict |
|---|---|---|---|---|---|
| 001 | sg560 | ct | SN 187 (cal 11212) | 187 | OK |
| 001 | sg560 | do | SN 805 (cal 12208) | 805 | OK - CAL DATE NOT IN OGDB: file says '12208' -> 2008-01-22/2008-02-12/2008-12-02; DB has 2011-10-08, 2019-04-23 |
| 007 | sg560 | ct | SN 187 (cal 11212) | 187 | OK |
| 007 | sg560 | do | SN 805 (cal 12208) | 805 | OK - CAL DATE NOT IN OGDB: file says '12208' -> 2008-01-22/2008-02-12/2008-12-02; DB has 2011-10-08, 2019-04-23 |
| 018 | sg560 | ct | SN 187 (cal 16-Apr-2015) | 187 | OK - CAL DATE NOT IN OGDB: file says '16-Apr-2015' -> 2015-04-16; DB has 2012-01-12, 2017-11-03, 2024-06-18, 2024-07-14; coefficients match NO DB cal row |
| 018 | sg560 | do | SN 805 (cal ?) | 805 | OK - file cal date unreadable (''); DB cals: 2011-10-08, 2019-04-23 |
| 024 | sg560 | ct | SN 180 (cal 14-Nov-2014) | 187 | **MISMATCH** - CAL DATE NOT IN OGDB: file says '14-Nov-2014' -> 2014-11-14; DB has 2017-05-16, 2017-05-24; coefficients match NO DB cal row |
| 024 | sg560 | do | SN 805 (cal ?) | 805 | OK - file cal date unreadable (''); DB cals: 2011-10-08, 2019-04-23 |
| 026 | sg562 | ct | SN 263 (cal 04apr2016) | 263 | OK - CAL DATE NOT IN OGDB: file says '04apr2016' -> 2016-04-04; DB has 2016-04-20, 2018-01-21 |
| 026 | sg562 | do | SN 797 (cal 12208) | 797 | OK - CAL DATE NOT IN OGDB: file says '12208' -> 2008-01-22/2008-02-12/2008-12-02; DB has 2011-10-08, 2016-07-15, 2018-01-29 |
| 030 | sg560 | ct | SN 185 (cal 28-May-17) | 187 | **MISMATCH** |
| 030 | sg560 | do | SN 805 (cal ?) | 805 | OK - file cal date unreadable (''); DB cals: 2011-10-08, 2019-04-23 |
| 034 | sg562 | ct | SN 187 (cal 03-Nov-2017) | 263 | **MISMATCH** |
| 034 | sg562 | do | SN 797 (cal 04-May-2018) | 797 | OK - CAL DATE NOT IN OGDB: file says '04-May-2018' -> 2018-05-04; DB has 2011-10-08, 2016-07-15, 2018-01-29 |
| 036 | sg560 | ct | SN 185 (cal 05-Jun-19) | 187 | **MISMATCH** |
| 036 | sg560 | do | SN 805 (cal 23.04.2019) | 805 | OK |
| 038 | sg562 | ct | SN 191 (cal 03-Nov-2017) | 263 | **MISMATCH** - CAL DATE NOT IN OGDB: file says '03-Nov-2017' -> 2017-11-03; DB has 2022-02-23; coefficients match NO DB cal row |
| 038 | sg562 | do | SN 797 (cal 04-May-2018) | 797 | OK - CAL DATE NOT IN OGDB: file says '04-May-2018' -> 2018-05-04; DB has 2011-10-08, 2016-07-15, 2018-01-29 |
| 039 | sg562 | ct | SN 191 (cal 03-Nov-2017) | 263 | **MISMATCH** - CAL DATE NOT IN OGDB: file says '03-Nov-2017' -> 2017-11-03; DB has 2022-02-23; coefficients match NO DB cal row |
| 039 | sg562 | do | SN 797 (cal 04-May-2018) | 797 | OK - CAL DATE NOT IN OGDB: file says '04-May-2018' -> 2018-05-04; DB has 2011-10-08, 2016-07-15, 2018-01-29 |
| 042 | sg560 | ct | SN 380 (cal 02-Jan-20) | 187 | **MISMATCH** |
| 042 | sg560 | do | SN 805 (cal 23.04.2019) | 805 | OK |
| 055 | sg560 | ct | SN 380 (cal 02-Jan-20) | 187 | **MISMATCH** |
| 055 | sg560 | do | SN 805 (cal 23.04.2019) | 805 | OK |
| 056 | sg562 | ct | SN 185 (cal 05-Jun-2019) | 263 | **MISMATCH** - coefficients match NO DB cal row |
| 056 | sg562 | do | SN 797 (cal 04-May-2018) | 797 | OK - CAL DATE NOT IN OGDB: file says '04-May-2018' -> 2018-05-04; DB has 2011-10-08, 2016-07-15, 2018-01-29 |
| 067 | sg560 | ct | SN 191 (cal 23-Feb-22) | 187 | **MISMATCH** |
| 067 | sg560 | do | SN 805 (cal 23.04.2019) | 805 | OK |
| 078 | sg560 | ct | SN 191 (cal 23-Feb-22) | 187 | **MISMATCH** |
| 078 | sg560 | do | SN 805 (cal 23.04.2019) | 805 | OK |
| 090 | sg560 | ct | SN 191 (cal 23-Feb-22) | 187 | **MISMATCH** |
| 090 | sg560 | do | SN 805 (cal 23.04.2019) | 805 | OK |
| 101 | sg559 | ct | SN 192 (cal 08.Jun.2016) | 192 | OK |
| 101 | sg559 | do | SN 809 (cal 071516) | 809 | OK |

## 2. Missions with no sensors yet - what would be added

| Mission | Glider | CT | DO | ECO | Open points |
|---|---|---|---|---|---|
| 004 | sg559 | SN 185 (cal?) | SN 809 (cal?) | - |  |
| 005 | sg564 | SN 194 (cal?) | SN 796 (cal?) | - | WETLabs constants active but NO serial in file; 470nm scale factor matches DB cal of: SN 870 (cal 2011-10-28) |
| 006 | sg562 | SN 191 (cal?) | SN 797 (cal?) | - |  |
| 008 | sg561 | SN 189 (cal?) | SN 799 (cal?) | - |  |
| 010 | sg563 | SN 192 (cal?) | SN 801 (cal?) | - | WETLabs constants active but NO serial in file; 470nm scale factor matches DB cal of: SN 871 (cal 2011-10-28) |
| 011 | sg564 | SN 194 (cal?) | SN 796 (cal?) | - | WETLabs constants active but NO serial in file; 470nm scale factor matches DB cal of: SN 870 (cal 2011-10-28) |
| 015 | sg559 | SN 263 (cal?) | SN 809 (cal?) | - |  |
| 016 | sg562 | SN 191 (cal?) | SN 797 (cal?) | - |  |
| 017 | sg561 | SN 189 (cal?) | SN 799 (cal?) | - |  |
| 019 | sg564 | SN 194 (cal?) | SN 796 (cal?) | - | WETLabs constants active but NO serial in file; 470nm scale factor matches DB cal of: SN 870 (cal 2011-10-28) |
| 020 | sg559 | SN 179 (**not in OGDB**) | SN 809 (cal?) | - |  |
| 021 | sg562 | SN 111 (**not in OGDB**) | SN 797 (cal?) | - |  |
| 023 | sg561 | SN 185 (cal?) | SN 799 (cal?) | - |  |
| 027 | sg563 | SN 191 (cal?) | SN 801 (cal?) | SN 871 |  |
| 029 | sg564 | SN 194 (cal?) | SN 796 (cal?) | - | WETLabs constants active but NO serial in file; 470nm scale factor matches DB cal of: SN 870 (cal 2011-10-28) |
| 031 | sg561 | SN 180 | SN 799 | - |  |
| 033 | sg564 | SN 194 | SN 796 (cal?) | SN 870 |  |
| 035 | sg563 | SN 189 | SN 801 | SN 871 |  |
| 037 | sg561 | SN 263 | SN 799 | - |  |
| 047 | sg564 | SN 194 | SN 796 | SN 870 |  |
| 058 | sg564 | SN 187 | SN 913 | SN 870 |  |
| 070 | sg564 | SN 187 | SN 913 | SN 870 |  |
| 073 | sg563 | SN 189 | SN 1005 | SN 871 |  |
| 075 | sg564 | SN 187 (cal?) | SN 913 | SN 870 |  |
| 084 | sg564 | SN 194 | SN 913 | SN 870 |  |
| 091 | sg563 | SN 263 | SN 799 | SN 871 |  |
| 094 | sg564 | SN 187 | SN 913 | SN 870 |  |
| 095 | sg561 | SN 189 | SN 805 | - | volmax(cc)->volume(L): DB=53.272 file=53.2721 |
| 097 | sg563 | SN 263 | SN 799 | - | rho0->density: DB=1027.5 file=1028 |
| 098 | sg561 | SN 189 | SN 805 | SN 871 | mass(kg)->weight_in_air: DB=53632 file=53.632; rho0->density: DB=1025.53 file=1027.8 |
| 100 | sg629 | SN 297 (**not in OGDB**) | SN 4 (**not in OGDB**) | - |  |

## 3. Mission mass / volume / density

119 empty values would be filled from the files (mass -> `weight_in_air` kg, volmax cc/1000 -> `volume` L, rho0 -> `density`).

Existing values that differ from the file:

- 090: mass(kg)->weight_in_air: DB=54.351 file=54.4
- 095: volmax(cc)->volume(L): DB=53.272 file=53.2721
- 097: rho0->density: DB=1027.5 file=1028
- 098: mass(kg)->weight_in_air: DB=53632 file=53.632
- 098: rho0->density: DB=1025.53 file=1027.8

## 4. Files with more than one `sg_calib_constants.m`

- 055: used `reprocessed_bs3/sg_calib_constants.m`, also found ['reprocessed_bs3_old/sg_calib_constants.m']
