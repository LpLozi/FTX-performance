# CHANGELOG — Algoritma Parity Geçişi 03

"FTX Algoritma Parity Talimatı - 03"ne göre, Geçiş 02'de eklenen Coach
algoritmaları GERÇEK legacy kaynağıyla (`coach-plus.js`, `coach-refine.js`,
`app-base.html`) satır satır karşılaştırıldı. Yeni özellik, UI redesign
veya yeni state katmanı eklenmedi.

## Doğrulanan (değiştirilmeyen)

### Kalori koçu — `coachSelectors.ts#calorieCoachSuggestion`
Karşılaştırma sonucu: **zaten legacy ile aynı.** Cooldown (7 gün), veri
eşiği (14 günde ≥8 beslenme günü + her 7 günlük blokta ≥2 ölçüm), eşikler
(rate>-0.15 → -150 kcal, rate<-0.9 → +100 kcal, arası → stable), 1200 kcal
minimum sınırı — hepsi `coach-plus.js#calorieCoach()`/`weightAverages()`
ile birebir. **Kod değiştirilmedi.** Önceki STATUS-REPORT'taki
"basitleştirilmiş yeniden yorum" ifadesi hatalıydı, düzeltildi.

## Düzeltilen (gerçek farklar)

### `src/core/coachSelectors.ts` — `muscleFor()`
Öncelik sırası `coach-refine.js#muscle()` (nihai/son yüklenen kaynak) ile
birebir eşleşecek şekilde yeniden sıralandı: quads → hamstrings →
shoulders → chest → back → triceps → biceps → calves → abs. Önceki sıra
(chest önce, `&&!/shoulder/` guard'ıyla) çoğu isimde aynı sonucu veriyordu
ama garanti değildi; artık kaynağın kendisiyle aynı regex sırası.

### `src/core/coachSelectors.ts` — progressive overload (yeni: `refinedRecommendation`, `primarySets`, `loadStep`, `snapLoad`, `isReadinessLow`)
Eski `progressionSuggestion` (selectors.ts, REFERANS/ARTIR/KORU/TEKRAR+1
etiketli, farklı eşikli) yerine `coach-refine.js#refinedRec()`'in birebir
portu kullanılıyor: `pSets()` (working-type setler öncelikli, yoksa tüm
non-warmup setler), tekrar bandı + ortalama RIR + allMax/low koşulları,
`step()` (lateral/curl/triceps/fly için <15kg'da 1kg yoksa 2kg, diğerlerinde
2.5kg), `snap()` (0.5kg), `readinessLow()` ile ekstra %5 azaltma. Workout
ekranındaki "Bugünün ilerleme önerisi" kartı artık bunu kullanıyor ve
legacy'deki "Kg'yi uygula" butonunu da içeriyor (var olan
`SET_DRAFT_SET_FIELD` action'ı döngüyle yeniden kullanılıyor — yeni action
yok).

### `src/core/coachSelectors.ts` — kardiyo MET tablosu (`cardioMet`, `cardioKcal`, `CARDIO_TYPES`)
Önceki tablo (`Yürüyüş/Koşu/Bisiklet/Eliptik/Yüzme/Diğer`, sabit MET
değerleri) tamamen legacy kaynağıyla (`app-base.html#estimateCardio()`)
değiştirildi: 8 gerçek tür (Yürüyüş, Eğimli yürüyüş, Koşu, Bisiklet,
Eliptik, Kürek, İp atlama, Merdiven / StairMaster), Yürüyüş/Koşu için
hız-bazlı MET kademeleri, Eğimli yürüyüş için eğim-bazlı formül, yoğunluk
çarpanları (Hafif 0.8, Orta 1, Yüksek 1.25 — öncekiler 0.75/1/1.3 idi,
yanlıştı). `currentWeight()` de eklendi: ölçüm → `profile.startWeight` →
80 zincirleme fallback (`app-base.html#currentWeight()` ile birebir;
öncekinde sabit 75 fallback vardı).

### `src/core/coachSelectors.ts` — "Günü kurtar" (`rescueMealPlans`)
Legacy'de GERÇEK bir kaynak bulundu: `coach-plus.js#rescueCandidates()` +
`#rescuePlans()` + `#foodMacros()`. İki gerçek fark düzeltildi:
1. Kullanıcının kayıtlı kullanım geçmişi 5'ten azsa, legacy sabit bir
   fallback besin listesiyle (`Whey protein, Süzme yoğurt, Tavuk göğsü
   (pişmiş), Ton balığı suda, Lor peyniri, Skyr, Hindi göğsü (pişmiş)`)
   havuzu dolduruyor — FTX'te eksikti, eklendi.
2. Porsiyon miktarları: gram bazlı besinlerde `[80,100,150,200,250]`,
   adet/porsiyon bazlı besinlerde `[1,1.5,2]` — FTX'te `[100,150,200]` ve
   `[1,2]` kullanılıyordu, legacy değerleriyle değiştirildi.
Puanlama formülü (pShort×11 + |budget-kcal|×0.28 + over×4 + pOver×2 +
items×4) ve kombinasyon eşikleri (kcal>budget×1.35 || protein>need×1.7)
zaten birebir aynıydı, değiştirilmedi.

### `src/features/workout/Workout.tsx`
`CARDIO_TYPES` sabit listesi kaldırıldı, `coachSelectors.ts`'ten export
edilen legacy-birebir liste kullanılıyor. Kardiyo kcal hesaplaması artık
hız ve eğimi de kullanıyor (öncesinde yalnızca tür+süre+yoğunluk).

## ALGORITHM-PARITY-REPORT.md (yeni)
Her algoritma için: legacy kaynak dosyası/fonksiyonu → FTX fonksiyonu →
SAME/CHANGED/NO LEGACY SOURCE tablosu.

## Besin parity — main branch çapraz kontrolü
Bu ortamda GitHub'a (network/API) erişimim yok; `LpLozi/form-tracker`'ın
`main` branch'iyle çapraz kontrol YAPILAMADI. Geçiş 02'deki 106/106 sonucu
yalnızca `claude-stabilization` branch'ine (kullanıcının yüklediği ZIP)
karşı doğrulanmış durumda. Bkz. ALGORITHM-PARITY-REPORT.md.

## Yeni testler
`tests/unit/algorithm-parity.test.ts` — A1-A8, 28 test. Tümü gerçek
legacy fixture'larına karşı yazıldı (kalori koçu eşikleri, kas eşleme
öncelik sırası, working/backoff/warmup set filtreleme farkı, progressive
overload step/snap/readiness, rescue fallback havuzu, MET tablosu).

## Regresyon durumu
W1-W5, M1, P1, S1 ve Geçiş 02'nin coach-parity testlerinin (C1/W6/PR1/G1/V1/M2/PH1/N1/CF1/N2/P2)
TAMAMI yeniden çalıştırıldı, hiçbiri silinmedi/zayıflatılmadı. V1 ve CF1
testlerinin ürettiği sayısal değerler algoritma düzeltmeleri nedeniyle
değişti (beklenen) ama testlerin kendisi (format/varlık kontrolü) aynı
kaldı ve geçti.

---

# CHANGELOG — Tamamlama Geçişi 02 (Feature Parity)

Bu geçiş "FTX Tamamlama Talimatı - 02" dokümanına göre yapıldı: eski FT'de
çalışan ama FTX'te eksik kalan 11 özellik + besin veritabanı parity'si
eksiksiz taşındı. Mimari değişmedi: hâlâ tek reducer + Context, hiçbir yeni
state katmanı, `window.*` veya event bus yok.

## Besin veritabanı parity (F1)

### `src/data/foods.ts` — tamamen yeniden üretildi
- **72 → 106 kalem.** Eski FT'nin GERÇEK kaynağından — `app-base.html`
  (`defaultFoods`, 78 kalem), `nutrition-plus.js` (`extras`, 20 kalem),
  `nutrition-raw-foods.js` (`RAW_FOODS`, 11 kalem) — programatik olarak
  (Node ile kaynak dosyaları parse edip gerçek JS objelerini materialize
  ederek) çıkarıldı ve FT'nin kendi migration mantığıyla birebir aynı
  kuralla (isim, `toLocaleLowerCase('tr-TR')`) dedupe edilerek birleştirildi.
  **Elle transkripsiyon yapılmadı** — hata riski sıfıra indirildi.
- Sonuç: 78 + 20 + 11 = 109 ham kayıt → 3 tekrar (aynı isimle iki kaynakta
  bulunan "Pirinç beyaz (pişmiş)" vb.) çıkarılınca 106 benzersiz kalem.
- Migration testleri yeni listeyle yeniden çalıştırıldı; `foodIndex → foodId`
  eşleşme mantığı (isim bazlı, pozisyon bağımsız) bu boyut değişikliğinden
  etkilenmedi.

## Yeni dosyalar

### `src/core/coachSelectors.ts`
Tüm yeni özelliklerin saf hesaplama mantığı — React'siz, test edilebilir:
`e1rm`, `exercisePR`, `exerciseHistory`, `newPRsForWorkout`, `workoutSummary`,
`muscleFor`, `muscleWeeklyVolume`, `weightTrend`, `calorieCoachSuggestion`,
`rescueMealPlans`, `cardioMet`/`cardioKcal`, `weeklyCalorieSummary`,
`fullWeeklyReport`.

### `src/components/LineChart.tsx`
Bağımsız, dış kütüphane gerektirmeyen SVG çizgi grafiği (canvas değil —
package.json'da bir chart kütüphanesi yok, eklemek yeni bir bağımlılık
getirirdi). Egzersiz geçmişi (G1) ve ölçüm trendi (M2) için ortak kullanılıyor.

### `src/features/workout/WorkoutSummaryModal.tsx` (W6)
Kaydet sonrası: süre, set sayısı, toplam hacim, önceki seansa göre %
değişim, kardiyo özeti, yeni PR'lar. `App.tsx`'te tek yerden render ediliyor.

## Değiştirilen dosyalar

### `src/core/types.ts`
- `UiState.workoutSummaryOpen: boolean` eklendi (W6 modalının açık/kapalı
  durumu — salt görüntü state'i, `PersistedState`'e hiçbir şey eklenmedi).
  `photoCompare` alanı zaten vardı, artık gerçekten kullanılıyor (PH1).

### `src/core/reducer.ts`
- **Yalnızca 2 yeni action:** `CLOSE_WORKOUT_SUMMARY`, `SET_PHOTO_COMPARE`
  (ikisi de salt UI state yazıyor). `SAVE_WORKOUT`/`SAVE_HYROX` artık ayrıca
  `ui.workoutSummaryOpen: true` set ediyor.
- **Yeni handler EKLENMEDİ** kalori koçu, kardiyo, günü kurtar için — hepsi
  zaten var olan `ACCEPT_CALORIE_SUGGESTION`, `DISMISS_CALORIE_SUGGESTION`,
  `SET_DRAFT_CARDIO`, `ADD_MEAL_ITEM` action'larını yeniden kullanıyor. Bu,
  talimatın 3. maddesindeki "aynı davranış için ikinci handler tanımlama"
  kısıtına uymak için bilinçli bir tasarım kararı.

### `src/features/panel/Panel.tsx`
- "Bu haftanın yükü" kartı **tam haftalık rapora** (P2) genişletildi:
  antrenman/plan oranı, protein günleri, ort. kalori, set sayısı, ton
  hacim, kardiyo dakika, kilo trendi, verdict metni.
- Kalori koçu kartı eklendi (C1).
- Haftalık kas grubu hacim kartı eklendi (V1).

### `src/features/workout/WorkoutExerciseCard.tsx`
- Her egzersiz kartına "Performans & PR" bölümü eklendi: en ağır set,
  tahmini 1RM PR, egzersiz geçmişi grafiği (PR1 + G1).

### `src/features/workout/Workout.tsx`
- Kardiyo finisher formu eklendi (CF1): tür/süre/hız/eğim/yoğunluk, canlı
  MET tabanlı kcal tahmini, kaydedince antrenmana ekleniyor.

### `src/features/measurements/Measurements.tsx`
- Ağırlık/bel/tahmini yağ oranı trend grafiği eklendi (M2).

### `src/features/photos/Photos.tsx`
- Önce/sonra karşılaştırma eklendi (PH1): aynı poz + iki tarih seçimi +
  CSS `clip-path` tabanlı wipe slider.

### `src/features/nutrition/Nutrition.tsx`
- Haftalık kalori kartı eklendi (N2): hedef/gerçekleşen/ort./fark.
- "Günü kurtar" kartı eklendi (N1): kalan protein/kalori bütçesine göre en
  sık kullanılan besinlerden 1-2 besinlik kombinasyon önerisi, tek
  dokunuşla `ADD_MEAL_ITEM` üzerinden ekleniyor (yeni action yok).

### `src/state/StoreProvider.tsx`
- Başlangıç `ui` state'ine `workoutSummaryOpen: false` eklendi.

### `src/features/workout/ProgramSelector.tsx`
- `<select id="program-select">` — test/otomasyon amaçlı kararlı bir hedef
  (kardiyo formu artık aynı ekranda ek `<select>`ler getirdiği için genel
  `'select'` seçicisi belirsizleşti; bu, davranışı DEĞİL yalnızca test
  edilebilirliği etkiler).

## Test dosyaları

### `tests/e2e/coach-parity.spec.ts` (yeni, 11 test)
C1, W6, PR1, G1, V1, M2, PH1, N1, CF1, N2, P2 — her biri gerçek tarayıcıda.

### `tests/e2e/draft-isolation.spec.ts`, `features.spec.ts`, `migration.spec.ts`, `coach-parity.spec.ts`
- Program seçici referansları `#program-select`'e sabitlendi.
- `draft-isolation.spec.ts`: kaydet sonrası açılan özet modalını kapatan
  bir adım eklendi (W6 modalı testin akışını bloklamasın diye).

## Regresyon durumu
Mevcut W1-W5, M1, P1, S1, HYROX geçişi, egzersiz geçici/kalıcı swap, yedek
export/import, telafi antrenmanı testlerinin **hiçbiri silinmedi veya
zayıflatılmadı** — ikisi (program-selector seçici belirsizliği, kaydet
sonrası modal) küçük test-uyum düzeltmesi gerektirdi, davranış testleri
aynı kaldı. Tam sonuçlar STATUS-REPORT.md'de.

---

# CHANGELOG — Stabilizasyon Geçişi 01

Bu geçiş, önceki teslimatın "FTX Stabilizasyon ve Düzeltme Talimatı - 01"
dokümanına göre denetlenmesi ve düzeltilmesi amacıyla yapıldı. Yeni özellik
eklenmedi; yalnızca mevcut mimari stabilize edildi ve gerçek toolchain
gereksinimlerine uyumlu hale getirildi.

## Düzeltilen dosyalar

### `tsconfig.json`
- `target`: `ES2020` → `ES2022`
- `lib`: `["ES2020","DOM","DOM.Iterable"]` → `["ES2022","DOM","DOM.Iterable"]`
- **Neden:** Kod `Array.prototype.at()` kullanıyordu (`src/core/selectors.ts`,
  `src/features/panel/Panel.tsx`, `src/features/workout/Workout.tsx`) ama
  proje `lib`'i bu API'yi tanımıyordu. Gerçek `tsc --strict` bu haliyle
  hata verirdi. Bu, önceki raporda "0 hata" denen ama gerçekte projenin
  KENDİ `tsconfig.json`'ı yerine ayrı, geçici bir tsconfig ile test edilmiş
  olmasından kaynaklanan bir tutarsızlıktı — şimdi projenin gerçek
  `tsconfig.json`'ı ile doğrulandı.

### `tests/unit/reducer.test.ts`, `migration.test.ts`, `selectors.test.ts`
- `from '../../src/core/reducer.ts'` gibi `.ts` uzantılı import'lar,
  uzantısız hale getirildi (`from '../../src/core/reducer'`).
- **Neden:** `moduleResolution: "bundler"` ile gerçek `tsc`, `.ts` uzantılı
  import path'lerini reddeder (`allowImportingTsExtensions` açık değilse).
  Önceki doğrulama `tsx` runtime'ı üzerinden yapılmıştı; `tsx` bu kurala
  uymadığı için hata gizlenmişti.

### `src/core/types.ts`
- `PhotoMeta` arayüzüne `legacySourceIndex?: number` alanı eklendi.
- **Neden:** Fotoğraf migration'ının kesintiye dayanıklı (resumable) hale
  getirilmesi için, her `photoIndex` kaydının hangi eski FT fotoğrafına
  karşılık geldiğini HER açılışta yeniden bulabilmek gerekiyordu.

### `src/core/migrations/fromLegacyFT.ts`
- `photoIndex` oluşturulurken her kayda `legacySourceIndex: i` eklendi.

### `src/core/dataLayer.ts`
- **`migratePhotosToIndexedDB()` fonksiyonu tamamen kaldırıldı ve yerine
  `ensurePhotosMigrated()` yazıldı.**
- **Neden (kritik):** Eski `migratePhotosToIndexedDB()` kodda vardı ama
  **hiçbir yerden çağrılmıyordu** — tamamen ölü kod. Talimatın 4. maddesi
  bunu doğrudan işaret etti: "Kodda yalnızca migration fonksiyonunun
  bulunması yeterli değil... gerçekten çağrıldığını kanıtla."
- Yeni `ensurePhotosMigrated()`:
  - Her uygulama açılışında çağrılır (yalnızca ilk migration'da değil).
  - Her fotoğraf için önce IndexedDB'de bayt var mı diye kontrol eder;
    varsa atlar (idempotent — ikinci çalıştırma duplicate üretmez).
  - Eksik olanı, eski `formDB`'nin (hâlâ localStorage'da, hiç silinmemiş)
    ilgili base64 verisinden yazar.
  - Kaynak base64 veriyi **hiçbir koşulda silmez.**
  - Kesintiye dayanıklıdır: bir önceki açılışta yarıda kalan (örn. sekme
    kapandığı için bazı fotoğrafların yazılamadığı) bir migration, sonraki
    açılışta otomatik olarak tamamlanır — bkz. `tests/e2e/photo-migration.spec.ts`
    içindeki "interrupted migration resumes" testi.

### `src/state/StoreProvider.tsx`
- `ensurePhotosMigrated()`'i uygulama mount olduğunda (bir kez) çağıran yeni
  bir `useEffect` eklendi.
- **Neden:** Fonksiyon var olması yetmez, gerçek boot akışına bağlanması
  gerekiyordu — bu, tam olarak o bağlantıyı kurar.

## Yeni test dosyaları

### `tests/e2e/photo-migration.spec.ts` (P1 — 3 test, 8 kontrol)
- Migration'ın gerçekten çağrıldığını, IndexedDB'de baytların gerçekten
  oluştuğunu, kaynağın silinmediğini, ikinci açılışta duplicate
  üretmediğini ve kesintiye dayanıklı olduğunu kanıtlar.

### `tests/unit/migration-crash-safety.test.ts` (8 test)
- Bozuk/eksik legacy veriyle (string yerine formDB, null elemanlı workouts
  array'i, olmayan foodIndex referansı, yanlış tipte alanlar, tamamen boş
  obje, her yerde null/undefined) migration'ın crash etmediğini kanıtlar.

## Değişmeyenler
- Reducer, selectors, seed, diğer migration mantığı, tüm UI bileşenleri —
  önceki geçişten değişmedi.
- `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
  değişmedi.

## Bu geçişte YAPILMAYANLAR (bilinçli olarak)
- Eksik Coach özellikleri (kalori koçu mantığı, PR takibi, antrenman özeti
  modalı, ağırlık/egzersiz grafikleri, "günü kurtar", kardiyo formu, foto
  karşılaştırma) **eklenmedi.** Talimat açıkça "bu aşamada yeni özellik
  ekleme" dediği için, bu geçiş yalnızca mevcut mimarinin stabilizasyonuna
  odaklandı. Bu eksikler ayrı, açık bir bölümde raporlanıyor (bkz. ana rapor
  Bölüm "Feature Parity — Dürüst Durum").
