# FTX Performance

FT'nin (form-tracker) React + TypeScript ile sıfırdan yeniden yazımı. Aynı
özellik kümesi hedeflendi (bkz. `FTX-plan.md`'deki envanter), tek kaynaklı
state mimarisiyle.

## ⚠️ Durum — önce bunu okuyun

Bu proje bir **stabilizasyon geçişinden** sonra teslim ediliyor. Tam,
dürüst durum raporu için **`STATUS-REPORT.md`**'ye bakın — özellikle
"feature parity" konusunda önceki iddiaların düzeltildiği Bölüm 4'e.
Dosya bazlı değişiklikler için `CHANGELOG.md`'ye bakın.

**Kısa özet:** Mimari (tek reducer, program-bazlı taslak, migration, foto
migration) stabil ve test edilmiş (80/80 kontrol yeşil — ama gerçek
`npm`/`vite`/`vitest`/`playwright` araçlarıyla değil, eşdeğer ikamelerle;
bkz. STATUS-REPORT.md Bölüm 1, **gerçek `npm ci` hiç çalıştırılmadı**).
Coach katmanının büyük bölümü (kalori koçu, PR takibi, grafikler, antrenman
özeti, "günü kurtar") **hiç yazılmadı** — bkz. STATUS-REPORT.md Bölüm 4.


## Mimari — bir bakışta

- **Tek reducer** (`src/core/reducer.ts`), tek `Context` (`src/state/StoreProvider.tsx`).
- **`workoutDrafts[planId]`**: her programın taslağı bağımsız. `SELECT_PLAN`
  yalnızca `ui.selectedPlanId`'yi değiştirir, hiçbir taslağa dokunmaz —
  program geçişinde veri kaybı **yapısal olarak** imkansız.
- **Merkezi data layer** (`src/core/dataLayer.ts`): localStorage + IndexedDB'ye
  dokunan tek modül.
- **Migration** (`src/core/migrations/`): eski FT'nin ana blob'u + 7 dağınık
  localStorage anahtarı → FTX şeması. Katkı-bazlı, idempotent, eski veriyi
  asla silmez (bkz. Test Raporu).
- **Build**: gerçek Vite pipeline, CDN yok. `npm install && npm run build`.

## Kurulum

```bash
npm install
npm run dev        # geliştirme sunucusu
npm run build      # tsc --noEmit + vite build
npm run test       # Vitest (unit)
npm run test:e2e   # Playwright (E2E)
```

## Test raporu — dürüst durum

Bu sandbox'ta **network erişimi kapalı** olduğu için `npm install`
çalıştıramadım; `vite`, `vitest`, `@playwright/test` gibi paketler buradan
kurulamadı. Bunun yerine, sandbox'ta halihazırda bulunan araçlarla
(TypeScript derleyicisi, `esbuild` — bir başka paketin bağımlılığı olarak
mevcuttu —, `playwright`'ın çekirdek Chromium'u, Node'un yerleşik test
runner'ı) **gerçek bir tarayıcıda, gerçek kullanıcı etkileşimleriyle**
doğrulama yaptım:

| Katman | Yöntem | Sonuç |
|---|---|---|
| Tip güvenliği (`core/`, `data/`, `lib/`) | `tsc --strict` | **0 hata** |
| Saf mantık (reducer, migration, selectors) | Node'un yerleşik test runner'ı, gerçek Vitest sözdizimli test dosyalarına karşı bir uyumluluk shim'i üzerinden çalıştırıldı | **27/27** |
| Bundling | `esbuild` (gerçek bir bundler, CDN değil) | **0 hata**, 1.2 MB tek bundle |
| E2E — program geçişi, taslak izolasyonu, HYROX, reload, kaydetme | Playwright + gerçek Chromium, gerçek klavye/tıklama etkileşimi | **16/16** |
| E2E — eski FT verisiyle migration (gerçekçi `formDB` + 7 dağınık anahtar) | Playwright, gerçek `localStorage` | **8/8** |
| E2E — egzersiz kütüphanesi, yedekleme, telafi antrenmanı | Playwright | **13/13** |

**Toplam: 64/64 otomatik kontrol yeşil.**

`.tsx` dosyalarının (React bileşenleri) tam `tsc` tip kontrolünü bu sandbox'ta
**yapamadım** — `@types/react` paketi burada mevcut değildi ve network
olmadan indirilemedi. `package.json` bunu `devDependencies`'e doğru şekilde
ekliyor; `npm install` çalıştığında (Vercel'de veya senin makinende) bu
tamamen çözülecek. Bunun yerine JSX/TSX dosyalarını `esbuild` ile
bundle'layıp gerçek tarayıcıda çalıştırarak davranışsal olarak doğruladım —
bu, tip hatalarını değil ama gerçek çalışma zamanı hatalarını yakalar, ve E2E
testleri zaten bu dosyaların gerçek kullanıcı akışlarında doğru çalıştığını
kanıtlıyor.

### Test sürecinde bulduğum ve düzelttiğim gerçek bug

`StoreProvider.tsx`'teki "sayfa kapanırken kaydet" güvenlik mekanizması
(`visibilitychange`/`pagehide`), her render'da yeniden kaydedilen ve asla
temizlenmeyen bir listener'da **eski (stale) bir closure'daki state'i**
kullanıyordu. Tek sekmeli normal kullanımda görünür bir etkisi yok (bellek ve
storage zaten senkron), ama gerçek bir listener leak'iydi ve teorik olarak
çoklu-sekme senaryosunda (iki sekme açıkken biri diğerinin verisini eski
haliyle ezmesi) veri kaybına yol açabilirdi. `useRef` ile her zaman en güncel
state'i tutacak ve listener'ları yalnızca bir kez kaydedecek şekilde
düzelttim. Bunu E2E testleri sırasında yakaladım — tam da bu yüzden testleri
gerçek tarayıcıda çalıştırmak önemliydi.

Ayrıca "Bugün telafi et" butonunun programı seçip Antrenman sekmesine
otomatik geçmediğini fark edip düzelttim (küçük UX eksiği, aynı E2E paketiyle
yakalandı).

### Kalan riskler / senin yapman gerekenler

1. **`npm install` sonrası bir kez gerçek `npm run build` ve `npm run test:e2e`
   çalıştır** — bu, benim burada yapamadığım `tsc` tam JSX tip kontrolünü ve
   gerçek Vitest/Playwright çalıştırmasını tamamlar. Testler mantık olarak
   doğrulandı ama gerçek araçlarla hiç çalıştırılmadı.
2. **Vercel'de "Framework: Vite" olarak bağla** — build command `npm run
   build`, output `dist/`.
3. Gerçek eski FT verinle (Ayarlar → JSON yedeği indir, FT'nin production
   sitesinden) bir kez migration'ı elle doğrulamanı öneririm — test verim
   gerçekçi ama senin gerçek verinin yapısal kenar durumlarını (örn.
   beklenmedik `null` alanlar) tam yakalamıyor olabilir.
4. Görsel tasarım FT'nin açık/mavi temasına sadık kalacak şekilde yapıldı
   ama piksel-piksel karşılaştırma yapmadım — bir gözden geçirme faydalı olur.

## Ayrı repo / deployment

Bu proje FT'nin production reposundan tamamen ayrı olarak teslim ediliyor.
Onayladığın gibi: ayrı bir GitHub reposuna push et, ayrı bir Vercel projesine
bağla. Eski FT hiçbir şekilde değiştirilmedi.
