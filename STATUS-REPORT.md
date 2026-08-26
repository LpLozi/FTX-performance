# FTX Performance — Durum Raporu (Geçiş 03: Algoritma Parity)

Bu rapor "FTX Algoritma Parity Talimatı - 03"e göre güncellendi ve önceki
geçişin (Tamamlama 02) durum raporunun yerini alır. Detaylı algoritma bazlı
karşılaştırma için **`ALGORITHM-PARITY-REPORT.md`**'ye bakın — bu dosya
genel durumu, test sonuçlarını ve kalan riskleri özetler.

## 0. Kabul kapısı (Talimat 03, madde 8)

| Koşul | Durum |
|---|---|
| Zaten legacy ile aynı kod korundu (kalori koçu değiştirilmedi) | ✅ |
| Kanıtlanmış farklar düzeltildi (kas eşleme, progressive overload, MET, rescue) | ✅ (Bölüm 1) |
| Kaynağı olmayan algoritmalar legacy parity diye sunulmuyor | ✅ — "Günü kurtar"ın legacy kaynağı bulundu ve düzeltildi; kaynağı olmayan hiçbir algoritma kalmadı |
| A1-A8 testleri yazılmış | ✅ 28 test + 1 bonus (A9) |
| R1 (mevcut regresyonların tamamı) yeşil | ✅ (Bölüm 3) |
| Gerçek npm toolchain doğrulaması | ❌ Bu ortamda yapılamadı (Bölüm 5) |

---

## 1. Bu geçişte düzeltilen gerçek farklar

Tam tablo `ALGORITHM-PARITY-REPORT.md`'de (legacy dosya#fonksiyon → FTX
fonksiyonu → SAME/CHANGED/NO LEGACY SOURCE). Özet:

| Algoritma | Önceki durum | Düzeltme |
|---|---|---|
| Kalori koçu | Zaten aynıydı | **Değiştirilmedi** — önceki raporun "basitleştirilmiş" ifadesi hatalıydı, düzeltildi |
| Kas grubu eşleme | Farklı öncelik sırası (aynı sonuçları verse de garanti değildi) | `coach-refine.js`'in nihai regex sırasıyla değiştirildi |
| Progressive overload | Tamamen farklı algoritma | `refinedRec()`'in birebir portu (`pSets`, `step()`, `snap()`, `readinessLow()` dahil); "Kg'yi uygula" butonu eklendi |
| Kardiyo MET tablosu | Yanlış tür listesi + yanlış MET değerleri | `estimateCardio()` ile birebir değiştirildi (8 tür, hız/eğim bazlı) |
| "Günü kurtar" | Kaynak var ama iki ayrıntı eksikti | Fallback besin havuzu + doğru porsiyon miktarları eklendi |
| Kilo trendi grafiği | 7 günlük hareketli ortalama eksikti | Eklendi |
| Haftalık kas hacmi (allSets) | Zaten doğruydu | Doğrulandı, değiştirilmedi |
| PR takibi, antrenman özeti | Zaten doğruydu | Doğrulandı, değiştirilmedi |

---

## 2. Yeni testler (A1-A9)

`tests/unit/algorithm-parity.test.ts` — 29 test, gerçek legacy davranışına
karşı:

| ID | Kapsam | Test sayısı |
|---|---|---|
| A1 | Kalori koçu: -150/+100/stable/collecting eşikleri | 4 |
| A2 | Cooldown: 6. gün vs 7. gün | 2 |
| A3 | Kas eşleme önceliği (shoulder press→shoulders, leg press→quads, vb.) | 4 |
| A4 | Haftalık hacim: working+backoff dahil, warmup hariç | 1 |
| A5 | Progressive overload: allMax/low, step(), snap(), pSets | 4 |
| A6 | readinessLow() %5 azaltma + eşik doğrulaması | 2 |
| A7 | Rescue: fallback havuzu, porsiyon miktarları | 2 |
| A8 | MET tablosu, yoğunluk çarpanları, currentWeight fallback zinciri, tür listesi | 8 |
| A9 (bonus) | Kilo trendi 7 günlük hareketli ortalama | 1 |

Tümü gerçek legacy kaynak kodundan (`coach-plus.js`, `coach-refine.js`,
`app-base.html`) türetilen sayısal fixture'larla, `node:test` + gerçek
Vitest API'sine eşlenen shim üzerinden çalıştırıldı — Bölüm 5'teki araç
kısıtı kapsamında.

---

## 3. Mevcut regresyonların yeniden çalıştırılması (R1)

| Paket | Sonuç |
|---|---|
| W1-W5 (draft izolasyonu, HYROX, refresh, reopen, save) | ✅ 16/16 |
| M1 (legacy migration + idempotency + crash-safety) | ✅ 8/8 (E2E) + 18/18 (unit) |
| P1 (foto migration) | ✅ 8/8 |
| S1 + kütüphane swap + yedekleme + telafi | ✅ 13/13 |
| Geçiş 02 coach-parity (C1/W6/PR1/G1/V1/M2/PH1/N1/CF1/N2/P2) | ✅ 21/21 |
| Unit toplamı (reducer+migration+selectors+crash-safety+algorithm-parity) | ✅ 64/64 |

**Toplam: 64 unit + 66 E2E = 130/130.**

V1 ve CF1 testlerinin ürettiği sayısal değerler algoritma düzeltmeleri
nedeniyle değişti (beklenen ve doğru) — testlerin kendisi (format/varlık
kontrolü) hiçbiri silinmedi/zayıflatılmadı, hepsi geçti.

---

## 4. Besin parity — main branch çapraz kontrolü (Talimat 03, madde 5)

**Yapılamadı.** Bu ortamda GitHub API/web erişimim önceden verilmiş bir URL
olmadan çalışmıyor. `LpLozi/form-tracker`'ın `main` branch'i için ne bir
URL sağlandı ne de arama sonucu böyle bir URL döndürdü. **Geçiş 02'deki
106/106 sonucu yalnızca `claude-stabilization` branch'ine göre
doğrulanmıştır; `main` branch ile aynı olduğu doğrulanmamıştır.** GitHub
erişimi olan taraf `main`'deki üç dosyayı (`app-base.html`,
`nutrition-plus.js`, `nutrition-raw-foods.js`) `claude-stabilization`'daki
karşılıklarıyla `diff` ile karşılaştırabilir.

---

## 5. Gerçek toolchain raporlama — DEĞİŞMEDİ

Üç geçiştir aynı: **bu ortamda internet erişimi yok.**

```
npm ci / npm install     -> HİÇ ÇALIŞTIRILMADI
npm run typecheck          -> HİÇ ÇALIŞTIRILMADI (gerçek @types/react ile)
npm run build                 -> HİÇ ÇALIŞTIRILMADI (gerçek vite ile)
npm test                        -> HİÇ ÇALIŞTIRILMADI (gerçek vitest ile)
npm run test:e2e                  -> HİÇ ÇALIŞTIRILMADI (gerçek @playwright/test ile)
```

Bölüm 3'teki 130/130, sandbox'ta zaten var olan eşdeğer araçlarla
(`tsc --strict` projenin gerçek `tsconfig.json`'ıyla, `esbuild --bundle`,
çıplak `playwright` çekirdeği + gerçek Chromium, `node:test` + Vitest
API'sine eşlenen shim) elde edildi — gerçek `npm`/`vite`/`vitest`/
`@playwright/test` değil.

---

## 6. Bilinen kalan riskler / bilinçli yapılmayanlar

1. **Gerçek npm toolchain hâlâ hiç çalıştırılmadı** — değişmedi.
2. **`.tsx` dosyalarının tam tip kontrolü hâlâ yapılamadı** (`@types/react` yok).
3. **Besin main branch karşılaştırması yapılamadı** (Bölüm 4).
4. **Egzersiz geçmişi grafiği canvas yerine SVG** — veri mantığı aynı, render tekniği farklı (bilinçli, talimat "UI redesign yapma" dediği için değiştirilmedi, zaten Geçiş 02'den beri böyleydi).
5. PWA gerçek bir build ile hiç test edilmedi.
6. Gerçek kullanıcının kendi eski FT verisiyle migration hâlâ hiç denenmedi.
7. Preview deployment adresi hâlâ yok.

## 7. Önerilen sıradaki adımlar
1. Gerçek `npm ci` + tüm script'ler network erişimli bir ortamda çalıştırılmalı.
2. `main` branch besin karşılaştırması GitHub erişimi olan tarafça tamamlanmalı.
3. GitHub push + Vercel preview deploy + manuel gözden geçirme.


---


---

# EK: Geçiş 02 (Tamamlama) Durum Raporu — arşiv

Aşağıdaki bölümler, önceki geçişin (Talimat 02) orijinal durum raporudur; referans için korunuyor.

## 1. Feature parity matrisi

| Eski FT özelliği | FTX karşılığı | Test ID | Durum |
|---|---|---|---|
| Kalori koçu (7 günlük trend, öneri, cooldown) | `coachSelectors.ts#calorieCoachSuggestion` + Panel kartı | C1 | ✅ |
| Antrenman sonrası özet modalı | `WorkoutSummaryModal.tsx` | W6 | ✅ |
| PR takibi (en ağır set, e1RM, hacim) | `coachSelectors.ts#exercisePR` + egzersiz kartı | PR1 | ✅ |
| Egzersiz geçmişi grafiği | `coachSelectors.ts#exerciseHistory` + `LineChart` | G1 | ✅ |
| Kas grubu haftalık hacim | `coachSelectors.ts#muscleWeeklyVolume` + Panel kartı | V1 | ✅ |
| Ölçüm trend grafiği | `Measurements.tsx` + `LineChart` | M2 | ✅ |
| Foto önce/sonra karşılaştırma | `Photos.tsx#PhotoCompare` (wipe slider) | PH1 | ✅ |
| "Günü kurtar" öneri | `coachSelectors.ts#rescueMealPlans` + Nutrition kartı | N1 | ✅ |
| Kardiyo finisher (MET kcal) | `Workout.tsx#CardioFinisher` | CF1 | ✅ |
| Haftalık kalori kartı | `coachSelectors.ts#weeklyCalorieSummary` + Nutrition kartı | N2 | ✅ |
| Tam haftalık rapor | `coachSelectors.ts#fullWeeklyReport` + Panel kartı | P2 | ✅ |
| Besin veritabanı (tam liste) | `data/foods.ts` (106 kalem) | F1 | ✅ |
| Program seçimi tek source of truth | `reducer.ts#SELECT_PLAN` | S1 | ✅ (önceki geçiş) |
| Program bazlı draft izolasyonu | `workoutDrafts[planId]` | W1-W5 | ✅ (önceki geçiş, bozulmadı) |
| Legacy migration | `migrations/fromLegacyFT.ts` | M1 | ✅ (önceki geçiş, bozulmadı) |
| Foto migration (IndexedDB, resumable) | `dataLayer.ts#ensurePhotosMigrated` | P1 | ✅ (önceki geçiş, bozulmadı) |
| 250+ egzersiz kütüphanesi | `data/exerciseLibrary.ts` (251 hareket) | — | ✅ (önceki geçiş) |
| Egzersiz geçici/kalıcı swap | `reducer.ts#SWAP_EXERCISE` | — | ✅ (önceki geçiş, bozulmadı) |
| Telafi antrenmanı akışı | `reducer.ts#START_CATCHUP` | — | ✅ (önceki geçiş, bozulmadı) |
| HYROX Hybrid | `Workout.tsx#HyroxScreen` | — | ✅ (önceki geçiş, bozulmadı) |
| PWA (manifest + service worker) | `vite.config.ts` (vite-plugin-pwa) | — | ⚠️ yapılandırıldı, gerçek build ile hiç test edilmedi |

**Sonuç: Talimat 02'nin 1. maddesindeki 11 kalemin tamamı + besin parity
uygulandı ve test edildi.**

---

## 2. Uygulanan parity özelliklerinin özeti

Tüm yeni mantık `src/core/coachSelectors.ts`'te — React'siz, saf fonksiyonlar
olarak yazıldı. UI tarafında yalnızca **2 yeni reducer action** eklendi
(`CLOSE_WORKOUT_SUMMARY`, `SET_PHOTO_COMPARE` — ikisi de salt UI state).
Kalori koçu, kardiyo finisher, "günü kurtar" gibi özellikler **var olan**
action'ları (`ACCEPT_CALORIE_SUGGESTION`, `SET_DRAFT_CARDIO`,
`ADD_MEAL_ITEM`) yeniden kullanıyor — talimatın 3. maddesindeki "aynı
davranış için ikinci handler tanımlama" kısıtına uyuldu. Dosya bazlı
ayrıntılar `CHANGELOG.md`'de.

---

## 3. Yeni testler

`tests/e2e/coach-parity.spec.ts` — 11 test, 21 ayrı kontrol:

| Test ID | Kontrol | Doğrulanan |
|---|---|---|
| C1 | 3 | Kalori koçu kartı render oluyor, durum metni/öneri+uygula akışı, karar geçmişi yazılıyor |
| W6 | 3 | Kaydet sonrası modal açılıyor, süre/set/hacim gösteriliyor |
| PR1+G1 | 2 | En ağır set doğru hesaplanıyor, geçmiş grafiği render oluyor |
| V1 | 2 | Kas grubu kartı render oluyor, planlanan/yapılan formatı doğru |
| M2 | 1 | Ölçüm trend grafiği render oluyor |
| PH1 | 3 | Karşılaştırma kartı, slider, iki fotoğraf overlay'i çalışıyor |
| N1 | 2 | Öneri kartı görünüyor, tek dokunuşla öğüne ekleniyor |
| CF1 | 3 | Form render oluyor, MET tahmini gösteriliyor, kayıtla birlikte kaydediliyor |
| N2 | 2 | Kart render oluyor, fark doğru hesaplanıyor |
| P2 | 1 | Tüm 6 zorunlu metrik gösteriliyor |

Tümü gerçek Chromium'da, gerçek DOM etkileşimiyle doğrulandı — Bölüm 6'daki
araç kısıtı kapsamında.

---

## 4. Mevcut regresyonların yeniden çalıştırılması (Talimat 02, madde 5)

| Paket | Sonuç |
|---|---|
| W1-W5 (draft izolasyonu, HYROX, refresh, reopen, save) | ✅ 16/16 |
| M1 (legacy migration + idempotency + crash-safety) | ✅ 8/8 (E2E) + 18/18 (unit) |
| P1 (foto migration) | ✅ 8/8 |
| S1 + kütüphane swap + yedekleme + telafi | ✅ 13/13 |
| Unit (reducer + migration + selectors + crash-safety) | ✅ 35/35 |

**Toplam: 35 unit + 66 E2E = 101/101.**

### Bu geçişte gerekli olan 2 test-uyum düzeltmesi (davranış değişmedi)
1. Kardiyo finisher formu aynı ekrana 2 yeni `<select>` (tür, yoğunluk)
   getirdiği için testlerin genel `page.locator('select')` kullanımı
   belirsizleşti. Gerçek programın `<select>`ine `id="program-select"`
   eklendi, tüm testler buna sabitlendi — davranış değişikliği değil,
   yalnızca test hedefleme sağlamlığı.
2. Antrenman kaydet sonrası artık özet modalı açılıyor (W6, yeni özellik);
   eski testler bunu bilmediği için sonraki adımda takılıyordu. Testlere
   "modalı kapat" adımı eklendi.

Her iki düzeltme de testi **zayıflatmadı veya silmedi** — yalnızca yeni,
gerçek UI davranışına uyarladı.

---

## 5. Besin parity sayısal özeti (Talimat 02, madde 7)

| | Sayı |
|---|---|
| FT `app-base.html` (`defaultFoods`) | 78 |
| FT `nutrition-plus.js` (`extras`) | 20 |
| FT `nutrition-raw-foods.js` (`RAW_FOODS`) | 11 |
| **FT toplamı (ham, tekrarlar dahil)** | **109** |
| Tekrar eden isimler (case-insensitive) | 3 |
| **FT toplamı (benzersiz)** | **106** |
| **FTX toplamı** | **106** |
| **Eksik** | **0** |

Çıkarım yöntemi: FT'nin orijinal kaynak dosyaları (kullanıcının önceki bir
görevde yüklediği ZIP'ten, `LpLozi/form-tracker`'ın `claude-stabilization`
branch'i) Node ile programatik olarak parse edildi — `makeFood()` çağrıları
gerçek JS fonksiyonu olarak çalıştırılıp array elemanları JSON'a serialize
edildi, FTX'in `foods.ts` dosyası bu JSON'dan yine programatik üretildi.
**Elle kopyalama/yazma hiçbir aşamada yapılmadı.**

**Doğrulama isteğe bağlı ama önerilir:** Bu ortamda erişilen FT kaynağı
`claude-stabilization` branch'inden geliyor. Kullanıcının `main` branch'i
farklıysa (daha sonra elle düzenlenmişse), bu 106 sayısı o farkı yakalamamış
olabilir — GitHub erişimi olan taraf `main`'i de kontrol edebilir.

---

## 6. Gerçek toolchain raporlama (Talimat 02, madde 6) — DEĞİŞMEDİ

Önceki geçişteki durum aynen geçerli: **bu ortamda internet erişimi yok.**

```
npm ci / npm install     -> HİÇ ÇALIŞTIRILMADI
npm run typecheck          -> HİÇ ÇALIŞTIRILMADI (gerçek @types/react ile)
npm run build                 -> HİÇ ÇALIŞTIRILMADI (gerçek vite ile)
npm test                        -> HİÇ ÇALIŞTIRILMADI (gerçek vitest ile)
npm run test:e2e                  -> HİÇ ÇALIŞTIRILMADI (gerçek @playwright/test ile)
```

Bunun yerine (Bölüm 4'teki 101/101 dahil), eşdeğer araçlarla doğrulama:

| Katman | Araç |
|---|---|
| Tip güvenliği (core/, data/, lib/) | `tsc --strict`, projenin gerçek `tsconfig.json`'ı (bu geçişte `ES2022` lib düzeltildi) |
| Bundling (JSX dahil) | `esbuild --bundle` |
| Unit testler | `node:test` + gerçek Vitest `test`/`expect` API'sini `node:assert`'e eşleyen shim |
| E2E | çıplak `playwright` çekirdeği, gerçek Chromium |

`.tsx` dosyalarının tam `tsc` tip kontrolü **hâlâ yapılamadı**
(`@types/react` bu ortamda yok). Bu geçişte eklenen yeni `.tsx` dosyaları
(`LineChart.tsx`, `WorkoutSummaryModal.tsx`) da aynı şekilde yalnızca
esbuild+tarayıcı ile doğrulandı, gerçek `tsc` ile değil.

---

## 7. Bilinen kalan riskler / bilinçli yapılmayanlar

1. **Gerçek npm toolchain hâlâ hiç çalıştırılmadı** — en kritik risk, değişmedi.
2. **`.tsx` dosyalarının tam tip kontrolü hâlâ yapılamadı.**
3. **PWA gerçek bir build ile hiç test edilmedi** — yalnızca yapılandırma olarak mevcut.
4. **Besin listesi karşılaştırması yalnızca ZIP'teki FT kaynağına karşı yapıldı** — `main` branch farklıysa fark olabilir (Bölüm 5).
5. **Kalori koçu ve "günü kurtar" algoritmaları FT'nin orijinal mantığından basitleştirilmiş bir yeniden yorumdur** — aynı davranışsal amacı (7 günlük trend bazlı öneri + cooldown; bütçeye uyan besin kombinasyonu önerisi) karşılıyor, ama FT'nin `coach-plus.js`/`coach-refine.js` kaynağındaki tam sayısal eşikleri (ör. yüzde kırılım noktaları) birebir port edilmedi. Davranış paritesi var, algoritma-birebir paritesi garanti değil.
6. **Kardiyo MET tablosu** basitleştirilmiş 6 kategori kullanıyor — FT'nin tam tablosuyla birebir karşılaştırılmadı.
7. **Kas grubu eşleme fonksiyonu (`muscleFor`)** isim bazlı basit bir eşleştirme (regex) — FT'nin kendi haritasıyla (varsa) birebir karşılaştırılmadı.
8. Gerçek kullanıcının kendi eski FT verisiyle migration hâlâ hiç denenmedi.
9. Preview deployment adresi hâlâ yok — bu ortamda GitHub/Vercel erişimim yok.

## 8. Önerilen sıradaki adımlar
1. Bu raporu alan taraf gerçek `npm ci` + tüm script'leri çalıştırıp Bölüm 6'daki "HİÇ ÇALIŞTIRILMADI" satırlarını gerçek sonuçlarla değiştirmeli.
2. Kalori koçu / günü kurtar / MET / kas grubu eşleme algoritmalarının FT'nin orijinal sayısal sabitleriyle karşılaştırılması istenirse ayrıca ele alınmalı (Bölüm 7, madde 5-7).
3. Gerçek build sonrası PWA'nın gerçekten kurulabilir/offline çalışır olduğu doğrulanmalı.
4. GitHub push + Vercel preview deploy + kullanıcı tarafından manuel gözden geçirme.
