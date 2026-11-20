# Seaglider refurb import: DRY RUN

Source: `GliderRefurb/` (skipping `GliderNotes` and `SG629_Rental`). Compared against `ogdb-test`.
**Nothing has been written to any database.** Helper: `gateway/scripts/refurb_cert_audit.py` (read-only).

## 1. Companies

| Name | In OGDB? | Action |
|---|---|---|
| IOP (Seaglider Center, APL-UW) | yes (`manufacturers` id 2) | none |
| Kongsberg (Kongsberg Maritime Ltd, Aberdeen; Kongsberg Underwater Technology Inc, KUTI, Lynnwood) | no | **add to `manufacturers`** |
| Hydroid (RMA00227G, 2020) | no | **add to `manufacturers`** |
| CSCS (Cyprus Subsea Consulting & Services, 2020 service) | no | not added: a service contractor, named in the event text only |

Decision: whether to also add `iRobot` (original maker, named in the 2023 IOP email).

## 2. Calibrations

Every CT and optode certificate in the folders was parsed with the app's own `parse_certificate.py` and compared to OGDB.
**Already in OGDB (cal row and certificate): 180 (16 and 24 May 2017), 185 (28 May 2017, 5 Jun 2019), 187, 189, 194 (16 Feb 2018), 263, 380, 192, optodes 796 (2018), 797, 799, 801, 805, 809, 913.** No double entries.

**Missing (3). Each gets a `calibration` event, a cal row and a certificate:**

| Sensor | Cal date (temperature) | Facility | Certificate to attach | Coefficients |
|---|---|---|---|---|
| CT 191 | 2016-03-31 | SBE | `Glider_APL_0191_31Mar16.pdf`, T then C merged with pdfunite (done in scratchpad). Also attach `88608R ServiceReport.pdf`. | parsed by the app parser |
| CT 194 | 2016-11-04 (post-cruise cal) | SBE | `SBE_CT0194_Cal.pdf` has the pages as C then T, so I would reorder to **T first** | read by eye from the scan (not machine-parsed): temp g 4.34294126e-3, h 6.22949524e-4, i 2.30752834e-5, j 2.48116416e-6; cond g -9.60080706, h 1.09616581, i -6.52252141e-4, j 1.38966187e-4, cpcor -9.57e-8, ctcor 3.25e-6 |
| Optode 796 | 2016-10-12 | AADI | `AA4330_796_Cal.pdf` | foil 2808F; TempCoef 2.61909e1, -3.12184e-2, 2.94009e-6, -4.33530e-9; PhaseCoef -8.14395, 1.17490, 0, 0 |

- CT 191 note: the placeholder I added earlier (cal date 2017-11-03, from missions 038/039) has **different coefficients** from this 2016 cert, so it is a separate, not yet found, calibration. I would leave the placeholder as it is.
- Ignored on purpose: the WETLabs 870/871 per-channel charsheets (OGDB already has the Oct 2011 sheets), Kistler pressure sensor sheets (not CT/DO), the optode 913 test and pressure sheets (the multipoint cert is already in), and manuals and warranty PDFs.
- Date mismatch to check: the 2016 refurb reports quote CT 192 as 15 Jun 2016 and CT 263 as 4 Apr 2016, while OGDB has 2016-06-08 and 2016-04-20 (probably the temperature dates, which is your rule). No change proposed.

## 3. Glider timeline (`asset_service_events`)

Style: type `factory_repair`, title `<kind> (RMA <no>)`, description is 2 to 4 short lines. The company is named at the start of each description.

### 3a. Existing entries to overwrite (so they match in tone), no new rows

| Glider | Event id | Date | Proposed title and description |
|---|---|---|---|
| 559 | 191 | 2016-08-29 | **Factory refurbishment (RMA U32708-A)**. Kongsberg Maritime Ltd. Standard 10/24V refurb. New end cap/VBD module and lower hatch. CT sail #0179 swapped out for #0192 (cal 2016). Optode #809 recalibrated. Argos tag removed. Trimsheet reweighed (~800 g discrepancy). |
| 562 | 117 | 2016-08-30 | **Factory refurbishment (RMA U32707-A)**. Kongsberg Maritime Ltd. Standard 10/24V refurb. New end cap/VBD module. CT sail #0111 swapped out for #0263. Optode #797 recalibrated. |
| 560 | 198 | 2017-07-18 | **Factory refurbishment (RMA U32929/A)**. Kongsberg Maritime Ltd. Standard 15/15V refurb: new batteries, gear mount collar, ICE firmware. CT #0180 sent for calibration (stanchion corrosion). Spare CT #0187 fitted. Optode #805 not recalibrated. |
| 561 | 201 | 2017-07-18 | **Factory refurbishment (RMA U32930/A)**. Same as above. CT #0185 sent for calibration (corrosion near thermistor grommet). Spare CT #0189 fitted. Optode #799 not recalibrated. |
| 560 | 200 | **2019-12-07 → 2019-07-12** | **Factory service (RMA00196G)**. Kongsberg Underwater Technology Inc. Poor communications: corroded antenna connector replaced, modem upgraded (flow control). VBD and mass shifter reconditioned. CT #0185 (cal 5 Jun 2019) and optode #805 (cal 23 Apr 2019) recalibrated. Batteries at 75%, not replaced. |
| 560 | 195 | 2020-08-27 | **Service by CSCS**. CSCS at UiB. New rudder. Mainboard swapped with SG561's (CT faults traced to mainboard). 15V batteries from SG561 fitted (82%). CT #0185 replaced by #380 (cal 2 Jan 2020). Trimmed for the Barents Sea. |
| 561 | 119 | 2020-08-27 | **Service by CSCS**. CSCS at UiB. Rudder broken. VBD failed on the last mission. Replacement VBD was the wrong voltage (10/24V, glider is 15V), so not fitted. Batteries and mainboard moved to SG560. Glider left disassembled. |
| 562 | 196 | 2020-08-07 to 08-27 | **Service by CSCS**. CSCS at UiB. New 24V battery, 10V from SG564. GPS cell replaced. Trimmed for the West Spitsbergen Current. Ice map and science file issues noted. |
| 564 | 197 | 2020-08-27 | **Service by CSCS**. CSCS at UiB. New 24V and 10V batteries. CT checked in tank against an SBE37. Trimmed for Dronning Maud Land. |
| 561 | 210 | **2014-08-01 → 2024-04-01** to 2024-08-01 | **VBD upgrade (APL-UW)**. IOP (Seaglider Center). VBD shipped Apr 2024, returned 22 Jul 2024. Rebuilt with low-pressure boost pump, Swagelok fittings, mechanical shaft seal. Tested 100 cycles to 1500 psi. Set D_BOOST,0 and T_BOOST,0. Existing attachment already there. |

Corrections found in existing entries: **560 / id 200** has day and month swapped (report says 7/12/2019). **561 / id 210** starts in 2014 and should be 2024 (I only know "April 2024", so I used day 01 as a placeholder).

### 3b. New entries (no existing match)

| Glider | Date | Title and description | Attach |
|---|---|---|---|
| 563 | 2016-05-03 | **Factory refurbishment (RMA 32641/A)**. Kongsberg Maritime Ltd. Corroded electronics hull and mass shifter bulkhead replaced, other corrosion sealed. New grounding/anode system, gear mount collar, batteries, antenna. CT #0192 (corroded) replaced by #0191 (cal 31 Mar 2016). | SG563_PostRefurbReport_030516.pdf |
| 564 | 2017-02-13 | **Factory refurbishment (RMA 32740/A)**. Kongsberg Maritime Ltd. Major oil leak: end cap returned to factory (magnetic seal replaced, VBD plumbing updated). New batteries, antenna module, lower hatch. CT #0194 (cal 4 Nov 2016) and optode #796 (cal 12 Oct 2016) recalibrated. | SG564_PostRefurbReport_130217.pdf |
| 562 | 2018-08-21 | **Factory service (RMA00147G)**. Kongsberg Underwater Technology Inc. Reduced VBD pump rate. Corrosion under an end-cap port, so end cap replaced. VBD and mass shifter reconditioned, 10/24V batteries. Kistler Ti pressure sensor, flow-control modem, Ametek antenna connector, ICE firmware. CT #0187 and optode #797 recalibrated. | SG562 Seaglider Service Report.pdf |
| 564 | 2018-07-25 | **Factory service (RMA00150G)**. Kongsberg Underwater Technology Inc. Failed pressure sensor replaced (Kistler). 10V battery replaced. VBD and mass shifter reconditioned. WETLabs reintegrated. Corrosion, so end cap replaced. CT #0194 (16 Feb 2018) and optode #796 (23 Feb 2018) calibrated. Flow-control modem, Ametek antenna. | SG564 Seaglider Service Report.pdf |
| 563 | 2019-09-18 to 2020-10-27 | **Factory repair (RMA00227G, case 3337)**. Shipped to KUTI 18 Sep 2019 (export declaration). Hydroid report. Roll retries and a 10V-bus abort after the Mar 2019 deployment. VBD magnetic-seal leak. Motors, potentiometers, modem and mainboard replaced (RevB → RevE ARM). The old Aanderaa optode had a short (cause of the abort). Replacement optode #913 bought Feb 2021 (cal 26 Feb 2021). | 20210108 Service report.pdf (and the export declaration, optional) |
| 564 | 2020-01-14 | **Factory warranty repair (Seattle)**. CT problems, repaired free under warranty, no battery change. **Source is only the 2020 CSCS note and the trimsheet date. No RMA number found.** | none |
| 563 and 564 | 2023-10 (shipped Oct 2023, notes 2023-11-06) | **VBD upgrade (APL-UW)**. IOP (Seaglider Center). SG563: oil leak, VBD rebuilt without removing the bladder (seized nut). SG564: slow pump rates, minor leak; red residue in the main pump; seized nut drilled out, new bladder. Both: Swagelok plumbing in series, low-pressure boost pump, mechanical shaft seal. Tested to 1500 psi. SG564 lin-pot limits reset (hardware 4060/415). One entry for each glider. | UBergen - VBD upgrade - service notes.pdf; the two efficiency plots; the APL-UW quote (optional) |

## 4. Folders I would NOT turn into events (technician folders, backups, copies)

`SG560_Refurb_202106`, `SG562_Refurb_202106`, `SG560_Refurb_202205`, `SG563_Refurb_202205`, `SG564_Refurb_202205`, `SG564_Refurb_202211` (CF card and data backups for new deployments), `SG560/561/562_Documents_202008` (copies of old trimsheets), `SG561_VBD_repair_202408` (already covered by event 210).

## 5. Folders where I cannot tell what happened. Please confirm

1. **SG563_Documents_201801** (trimsheet 21 Sep 2018, optode #801 cal Jan 2018, Kistler sensor): looks like a Kongsberg service in autumn 2018. There is no report and no RMA number. Event or skip?
2. **SG561_Documents_201810** (trimsheet 2 Oct 2018, optode #799 recalibrated 10 Sep 2018, CT 0263 cert): same question for SG561.
3. **SG560/561_Documents_201711** (trimsheets 22 Nov 2017, "CustomerOcean"): probably the post-refurb trim update, not a service. I would skip them.
4. The three CSCS dates (27 Aug 2020 for three gliders) look like the end of the service. Trimsheets are dated 17 to 18 Aug 2020. Leave as they are?

## 6. Other discrepancies noticed (not touched)

- Existing events carry `performed_by_contact_id` 4 (Hessevik) and 15 (Bruvik). These are the UiB "FAO" customer contacts on the Kongsberg reports, not the people who did the work. I would leave them alone.
- Calibration event id 190 (CT 192) has start date 2026-10-05, but the cal is 2016-06-08. Likely a date-entry slip. Suggest fixing it.
- CT 179 and CT 111 (assets I created for missions 20 and 21) were removed from SG559/SG562 in 2016 and returned to KUTI. That explains why they are "not yet located".
- The 2017 refurb reports say CT 0187 was installed on SG560 and 0189 on SG561 (spares sent from UiB). Worth checking against the mission builds for the missions after July 2017.

## 7. What I would do on approval

1. Write an idempotent SQL file, same style as before, to add the manufacturers, update or insert the events above, add the 3 calibrations and events, and attach the report files.
2. Copy the files in through the app upload (production owns the file storage), as with the key files. Merged and reordered certificates go in a review folder first.
3. Test on `ogdb-test`, then you run production.
