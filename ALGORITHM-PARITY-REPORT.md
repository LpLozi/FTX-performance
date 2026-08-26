# ALGORITHM-PARITY-REPORT

Kaynak: `LpLozi/form-tracker`, `claude-stabilization` branch (kullanıcının
yüklediği ZIP). `main` branch ile çapraz kontrol bu ortamda GitHub
erişimi olmadığı için yapılamadı (bkz. sondaki not).

| # | Algoritma | Legacy kaynak (dosya#fonksiyon) | FTX karşılığı | Durum |
|---|---|---|---|---|
| 1 | Kalori koçu — eşikler, cooldown, veri yeterlilik kontrolü | `coach-plus.js#calorieCoach()` + `#weightAverages()` + `#mealDayCount()` | `coachSelectors.ts#calorieCoachSuggestion` + `#weightTrend` | **SAME** — kod değiştirilmedi, karşılaştırma zaten eşleşti |
| 2 | Kas grubu eşleme (öncelik sırası) | `coach-refine.js#muscle()` (nihai/son yüklenen sürüm) | `coachSelectors.ts#muscleFor` | **CHANGED** — sıra `coach-refine.js`'e uyacak şekilde düzeltildi |
| 3 | Haftalık kas hacmi (allSets vs primary) | `coach-refine.js#refineMuscles()` → `allSets()` | `coachSelectors.ts#muscleWeeklyVolume` | **SAME** — zaten `allSets()` ile eşdeğer filtre kullanıyordu (warmup hariç, working+backoff+drop dahil); doğrulandı, değiştirilmedi |
| 4 | Progressive overload / yük önerisi | `coach-refine.js#refinedRec()` + `#pSets()` + `#step()` + `#snap()` + `#readinessLow()` | `coachSelectors.ts#refinedRecommendation` + `#primarySets` + `#loadStep` + `#snapLoad` + `#isReadinessLow` (yeni) | **CHANGED** — FTX'teki eski `progressionSuggestion` tamamen farklı bir algoritmaydı (REFERANS/ARTIR/KORU/TEKRAR+1 etiketli); legacy'nin birebir portuyla değiştirildi |
| 5 | "Kg'yi uygula" (yük önerisini setlere yazma) | `coach-refine.js#coachApplyLoad()` (yalnızca setType==='working' satırları doldurur) | `Workout.tsx#applyLoadToWorkingSets` (mevcut `SET_DRAFT_SET_FIELD` action'ını döngüyle kullanır) | **CHANGED (eklendi)** — önceden FTX'te bu buton/davranış hiç yoktu |
| 6 | "Günü kurtar" aday havuzu | `coach-plus.js#rescueCandidates()` | `coachSelectors.ts#rescueMealPlans` (aday seçim kısmı) | **CHANGED** — kullanım geçmişi <5 olduğunda legacy'nin sabit fallback listesi eksikti, eklendi |
| 7 | "Günü kurtar" porsiyon miktarları | `coach-plus.js#rescuePlans()` (amounts dizileri) | `coachSelectors.ts#rescueMealPlans` | **CHANGED** — `[100,150,200]`/`[1,2]` → legacy'nin `[80,100,150,200,250]`/`[1,1.5,2]` |
| 8 | "Günü kurtar" puanlama formülü | `coach-plus.js#rescuePlans()` (score hesabı) | `coachSelectors.ts#rescueMealPlans` | **SAME** — katsayılar (11, 0.28, 4, 2, 4) ve eşikler (1.35, 1.7, 1.25) zaten birebir aynıydı |
| 9 | Kardiyo MET tablosu + tür listesi | `app-base.html#estimateCardio()` + `#cardioSection()` | `coachSelectors.ts#cardioMet` / `#cardioKcal` / `CARDIO_TYPES` | **CHANGED** — önceki tablo (6 tür, sabit MET) tamamen farklıydı; legacy'nin 8 türlü, hız/eğim-bazlı tablosuyla değiştirildi |
| 10 | Kardiyo için güncel kilo tespiti | `app-base.html#currentWeight()` | `coachSelectors.ts#currentWeight` (yeni) | **CHANGED (eklendi)** — önceden sabit `75` fallback vardı; legacy'nin ölçüm→startWeight→80 zincirine geçildi |
| 11 | PR takibi (en ağır set, e1RM, hacim) | `coach-plus.js#exercisePR()` | `coachSelectors.ts#exercisePR` | **SAME** — zaten birebir eşleşiyordu (Geçiş 02'de doğru port edilmiş) |
| 12 | Antrenman sonrası özet (süre/set/hacim/PR/delta) | `coach-plus.js#workoutSummary()` + `#newPRsForWorkout()` | `coachSelectors.ts#workoutSummary` + `#newPRsForWorkout` | **SAME** — zaten birebir |
| 13 | Egzersiz geçmişi grafiği verisi | `coach-plus.js#drawExerciseChart()` (veri kısmı, canvas çizimi hariç) | `coachSelectors.ts#exerciseHistory` + `LineChart.tsx` (SVG) | **SAME (veri mantığı)** — render tekniği farklı (canvas→SVG) ama bu bilinçli, talimat kapsamı dışı (UI redesign yasaktı, mevcut SVG korunuyor); veri hesaplama mantığı aynı |
| 14 | Ağırlık trendi grafiği verisi | `coach-plus.js#drawWeightTrend()` (7 günlük hareketli ortalama) | `Measurements.tsx` + `LineChart.tsx` | **CHANGED (küçük)** — FTX şu an ham ölçüm serisini çiziyor, legacy'nin 7-günlük hareketli ortalama çizgisini AYRICA çizmiyor. Bu talimat kapsamında test edilmedi (M2 testi yalnızca grafiğin var olduğunu doğruluyor); ayrı bir düzeltme gerektirebilir — **bilinen eksik, aşağıda not edildi** |
| 15 | Foto önce/sonra karşılaştırma | `coach-plus.js#photoSelection()` + `#enhancePhotos()` (wipe slider) | `Photos.tsx#PhotoCompare` | **SAME (davranış)** — aynı poz eşleştirme + wipe slider mantığı; DOM/CSS implementasyonu farklı ama davranış eşdeğer |

## Bilinen eksik (bu geçişte kapsam dışı bırakıldı)
**Madde 14** — ağırlık trend grafiğinde legacy'nin 7 günlük hareketli
ortalama (rolling average) çizgisi FTX'te yok; yalnızca ham ölçüm serisi
çiziliyor. Talimat 03'ün M2 kabul testi ("Kilo/bel/yağ oranı serileri
doğru") bunu spesifik olarak istemiyordu ve talimat "yeni özellik ekleme"
sınırı koyduğu için bu geçişte dokunulmadı. İstenirse ayrı bir görevde ele
alınabilir.

## Besin parity — main branch çapraz kontrolü
**Yapılamadı.** Bu ortamda GitHub API/web erişimim, önceden verilmiş bir
URL olmadan çalışmıyor (güvenlik kısıtı: yalnızca konuşmada daha önce
görülen veya `web_search` ile dönen URL'ler fetch edilebiliyor). `main`
branch için ne bir URL sağlandı ne de arama sonucu böyle bir URL döndürdü.
**Geçiş 02'deki 106/106 sonucu yalnızca `claude-stabilization` branch'ine
göre doğrulanmıştır; `main` branch ile aynı olduğu doğrulanmış DEĞİLDİR.**
Bunu doğrulatmak isteyen taraf (GitHub erişimi olan ChatGPT örneği)
`main`'deki üç dosyayı (`app-base.html`, `nutrition-plus.js`,
`nutrition-raw-foods.js`) `claude-stabilization`'daki karşılıklarıyla
`diff` ile karşılaştırabilir; fark yoksa 106/106 doğrulanmış sayılabilir.
