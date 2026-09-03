# Stagepulse ZIP Consolidation — 2026-09-04

The project library was reviewed for Stagepulse ZIP artifacts. **30 ZIP artifacts** were found in the Stagepulse scope; **23 are byte-for-byte unique**. Exact duplicates remain represented by their original names in the delivery manifest, but the consolidated archive stores one binary copy per SHA-256.

The repository `main` branch is the source of truth. ZIP snapshots are not merged wholesale because that would reintroduce obsolete workflows, UI layers and security/runtime drift.

## Canonical direction

- Admin command center: one runtime file, `admin/command-center.js`.
- Admin runtime/bootstrap: `admin/admin-runtime.js`.
- Supabase admin authentication/data: dedicated Edge Functions.
- CI/CD: `stagepulse-ci.yml` + `apk-release.yml`.
- Android entry/update: canonical Kotlin sources under `android/app/src/main/java/tr/com/stagepulse/app/`.
- Historical ZIP changes are ported selectively after validation.

## Unique Stagepulse ZIP artifacts reviewed

1. `stagepulse-patched.zip`
2. `stagepulse-repo-ready.zip`
3. `Stagepulse.hatay-main.zip`
4. `Stagepulse-role-finance-v2.zip`
5. `Stagepulse-finance-model-v3.zip`
6. `Stagepulse-personel-yetkileri-guncel.zip`
7. `Stagepulse-Clean-Rebuild-10of10.zip`
8. `Stagepulse.hatay-main(1).zip`
9. `Stagepulse.hatay-clean.zip`
10. `Stagepulse.hatay-production-grade.zip`
11. `stagepulse-personel-debug-apk (2).zip`
12. `Stagepulse.hatay-main(2).zip`
13. `Stagepulse-frontend-responsive-fixes.zip`
14. `Stagepulse_SEO_Frontend_Preview.zip`
15. `stagepulse-SITE-AI.zip`
16. `Stagepulse_SEO_Push_Hazir_Paket.zip`
17. `Stagepulse_Multi_Search_SEO_V2.zip`
18. `Stagepulse.hatay-main(3).zip` (content-equivalent duplicate where applicable)
19. `Stagepulse.hatay-main(4).zip`
20. `Stagepulse.hatay-visual-rollback-SEO-preserved.zip`
21. `Stagepulse.hatay-main(5).zip`
22. `Stagepulse.hatay-main(6).zip`
23. `Stagepulse.hatay-color-fixed.zip`
24. `Stagepulse.hatay-color-pass.zip`
25. `stagepulse-clean-2026-09-01.zip`
26. `stagepulse-clean-2026-09-01(1).zip`
27. `stagepulse-clean-2026-09-01(1)(1).zip`
28. `Stagepulse.hatay-SEO-.zip`
29. `Stagepulse.hatay-main(7).zip`
30. `stagepulse-sync-edge-fix.zip`

The exact SHA-256/alias mapping is maintained in the generated delivery manifest accompanying the consolidated archive.
