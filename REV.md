# Packaging Decoder: revisions

## Rev 0.4 (2026-11-04)
Applies Perry's round 2 answers (R1–R7):
- **Foil bags (BS, SF, SK) are on the shelf**, though big orders may need buying. Method 41 jobs and BS/SF/SK unit containers no longer flag yellow; the bag step says to check stock at award and order from EDCO if short. 13 of the 271 past jobs move yellow → green. BL bags stay "buy". Method 42/52 stays yellow for its weather-resistant outer box. SD and SE moved from the weather-box rule to the MIL-spec bag rule (they're bags; still yellow).
- **Regular boxes** (E5, EC, D3, DO) stay green ("we get them in a few days").
- **Suppliers:** star boxes from Star Packaging; ED and other weather-resistant boxes from Royco or Uline; heat-treated pallets from Service Pallet.
- **Mark it** now matches how we label:
  - Item name exactly as the contract shows it, not the ERP or drawing name (DLA has written us up for this).
  - Item ID labels come from our label software, with a 2D bar code.
  - The MSL comes from DLA's VSM.
  - Skids are stenciled in paint (contract, NSN, PN, quantity).
  - Gross weight: MIL-STD-129 requires it on the shipping container, and we don't mark it today. The step says so; owner to decide.
- **Guide pictures:** the method picture's caption says to follow our steps where the picture differs (Perry: our instructions trump the guide).
- **Photos:** none for now; the guide diagrams stand in until we take our own.
- Reference version bumped so the live database reloads the flag rules.

## Rev 0.3 (2026-11-04)
- Expert review Round 2: a new "Round 2: Follow-ups" tab on /review with 7 questions (R1–R7, kept in file order). It opens first while any are unanswered. Part 1 keeps Q1–Q40 and every saved answer. The questions:
  - R1: BL and foil bags, shelf or buy (his two answers disagreed).
  - R2: regular boxes, green or yellow.
  - R3: the suppliers he marked "Other".
  - R4: the label lines the DLA guide requires.
  - R5: how we make the MSL.
  - R6: anything in the guides we do differently.
  - R7: his 5 photos.
- Not asked again: NS/NV, desiccant (Methods 50–55) and OPI E are on none of our 271 past contracts; PRESV 49 is on one.

## Rev 0.2 (2026-11-04)

Changes from the expert's review (Perry Stone answered all 40 questions and 69 codes on 2026-11-04).

- **Star packaging is 5–7 weeks**, not 8–10, for NR / NW foam boxes.
- **More jobs flag yellow:** wraps (EA, FA, GB, GH, JA) and cushioning (AD, BG, DA, GT, NB) are bought per job, about 3–4 weeks, so they now go on the 🛒 order list. Creped paper, tissue, lens paper and bubble wrap / foam stay on the shelf.
- **Code labels use the expert's wording** for the 25 codes he changed: the spec callout for materials (for example "MIL-DTL-117, Type I, Class E, Style 1 …") and the full instruction for steps and markings.
- **Cushioning thickness goes on all six sides** of the item.
- **Common mistakes are called out:** a regular commercial bag where a MIL-spec bag is required, and missing or wrong labels.
- **A sealed bag with no inner box named** goes in a box first only if the part is fragile.
- **Supplier:** MIL-spec clear bags (BL) and foil bags (BS, SF, SK) usually come from EDCO.
- **Review form fix:** a ready-made wording no longer gets cut off at "e.g." (that is what happened to code GX).



First version on GitHub, before the move to the Mac mini.

- **Decoder**: paste a DLA contract's packaging block, or type the MIL-STD-2073-1 codes, and get plain-English packing steps, a nesting picture, an order list (what to buy and what is on the shelf), a printable packing sheet, and a red / yellow / green flag for star packaging and buy-ahead materials.
- **History**: packaging from 271 blocks on our 231 past DLA awards, searchable by NSN, contract or part number.
- **Code lookup**: every MIL-STD-2073-1 Change 4 code, each with a short shop-floor label.
- **Expert review**: 40 questions and 69 code translations for our packaging veteran to check, ranked by how often they come up on our contracts, with answers saved per item, example photos, a CSV export, and a printable worksheet.
- Review photos are stored inside the database, shrunk to 1600 px first, so the regular database backup covers them.
- Admin password check ready for future admin-only features. Nothing is admin-only yet.
- Owner decisions on shop practice: no leak or seal test on heat-sealed bags, and the tool doesn't mention inner-box corners.
- Expert's packaging guides (docs/expert-guides): a "See the picture" diagram on each preservation-method step, plus label examples. The "Mark it" step now spells out the ID label, the bar codes (linear Code 39 is fine; 2D only with a UII) and where the labels go, and warns what a marking defect costs. Desiccant methods get the Method 50 label. A UII mentioned in the contract triggers a 2D warning.

