# Packaging Decoder: revisions

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

