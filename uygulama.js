"use strict";

// ═════════ Durum ve saklama ═════════
const DEPO_ANAHTAR = "seyirlik-v1";
const BOS_DURUM = () => ({
  kayit: {},          // id → { durum, puan, not, favori, izlenenBolum, toplamBolum, bolumZaman[], eklenme, izlenme }
  ozel: [],           // kullanıcının eklediği yapımlar
  afisler: {},        // katalog id → bulunan kapak adresi
  imdb: {},           // katalog id → bulunan IMDb kimliği
  afisDenendi: {},    // "kaynak:id" → true (tekrar tekrar sormamak için)
  rozetler: [],       // açılan rozet kimlikleri
  ekstra: { cevirme: 0, geceKusu: false },
  tmdb: "",
  tema: "koyu",
});

let D = yukle();

function yukle() {
  try {
    const ham = localStorage.getItem(DEPO_ANAHTAR);
    if (!ham) return BOS_DURUM();
    return Object.assign(BOS_DURUM(), JSON.parse(ham));
  } catch { return BOS_DURUM(); }
}
function kaydet() {
  try { localStorage.setItem(DEPO_ANAHTAR, JSON.stringify(D)); } catch { /* gizli pencere vb. */ }
}

// ═════════ Yardımcılar ═════════
const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const kacis = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sadeles = (s) => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const guvenliUrl = (u) => (typeof u === "string" && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "");
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const TURLER = ["Aksiyon", "Macera", "Animasyon", "Komedi", "Dram", "Suç", "Gerilim", "Korku", "Gizem", "Bilim Kurgu", "Fantastik", "Romantik", "Aile", "Müzik", "Tarih", "Savaş", "Belgesel"];
const YERLI = new Set(["babam-ve-oglum", "hababam-sinifi", "eskiya", "gora", "vizontele", "organize-isler", "ayla", "bir-zamanlar-anadoluda", "kis-uykusu", "ezel", "bir-baskadir", "atiye"]);
const DURUMLAR = {
  izlenecek: { ad: "İzlenecek", simge: "＋", kisa: "＋" },
  izliyorum: { ad: "İzliyorum", simge: "▶", kisa: "▶" },
  izledim: { ad: "İzledim", simge: "✓", kisa: "✓" },
  birakildi: { ad: "Yarım bıraktım", simge: "⏸", kisa: "‖" },
};

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const TUR_RENK = { "Aksiyon": 12, "Macera": 32, "Animasyon": 300, "Komedi": 48, "Dram": 222, "Suç": 352, "Gerilim": 265, "Korku": 0, "Gizem": 248, "Bilim Kurgu": 190, "Fantastik": 280, "Romantik": 335, "Aile": 140, "Müzik": 316, "Tarih": 28, "Savaş": 70, "Belgesel": 160 };

function tumOgeler() { return [...D.ozel, ...KATALOG]; }
// TMDB'de keşfet bölümünden gelen, henüz listeye girmemiş yapımlar (kaydedilmez)
const gecici = new Map();
function ogeBul(id) { return D.ozel.find((o) => o.id === id) || KATALOG.find((o) => o.id === id) || gecici.get(id); }
function kayit(id) { return D.kayit[id]; }
function kayitOlustur(id) {
  // TMDB'den gelen bir yapımla ilk kez bir şey yapılınca kalıcı olarak kataloğa alınır
  if (gecici.has(id) && !D.ozel.some((o) => o.id === id)) { D.ozel.unshift({ ...gecici.get(id) }); turSecDoldur(); }
  if (!D.kayit[id]) D.kayit[id] = { durum: null, puan: 0, not: "", favori: false, izlenenBolum: 0, bolumZaman: [], eklenme: Date.now() };
  return D.kayit[id];
}
function kayitTemizle(id) {
  const k = D.kayit[id];
  if (k && !k.durum && !k.puan && !k.favori && !k.not && !k.izlenenBolum) delete D.kayit[id];
}
function toplamBolum(o) { return (D.kayit[o.id]?.toplamBolum) || o.bolum || 1; }
function afisAdresi(o) { return guvenliUrl(o.afis) || guvenliUrl(D.afisler[o.id]); }
function imdbAdresi(o) {
  const kimlik = o.imdb || D.imdb[o.id];
  if (kimlik && /^tt\d+$/.test(kimlik)) return `https://www.imdb.com/title/${kimlik}/`;
  const sorgu = `${o.orijinal || o.ad}${o.yil ? " " + o.yil : ""}`;
  return `https://www.imdb.com/find/?q=${encodeURIComponent(sorgu)}&s=tt`;
}
function sureMetni(o) {
  if (o.tip === "film") return o.sure ? `${Math.floor(o.sure / 60)} sa ${o.sure % 60} dk` : "";
  const parca = [];
  if (o.sezon) parca.push(`${o.sezon} sezon`);
  parca.push(`${toplamBolum(o)} bölüm`);
  if (o.bolumDk) parca.push(`~${o.bolumDk} dk`);
  return parca.join(" · ");
}

// ═════════ Afiş ═════════
function afisHTML(o, ek = "") {
  const h = hash(o.id);
  const ilkTur = o.turler?.[0];
  const h1 = TUR_RENK[ilkTur] ?? h % 360;
  const h2 = (TUR_RENK[o.turler?.[1]] ?? (h1 + 40 + (h % 80))) % 360;
  const src = afisAdresi(o);
  const harf = [...(o.ad || "?")][0].toLocaleUpperCase("tr");
  return `<div class="afis ${src ? "resimli" : ""} ${ek}" style="--h1:${h1};--h2:${h2}">
    ${src ? `<img src="${kacis(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('resimli');this.remove()">` : ""}
    <span class="afis-sembol">${kacis(harf)}</span>
    <span class="rozet-tip">${o.tip === "dizi" ? "Dizi" : "Film"}</span>
    <span class="afis-ad">${kacis(o.ad)}</span>
    <span class="afis-alt"><span>${kacis(o.yil || "")}</span><span>${kacis(o.turler?.[0] || "")}</span></span>
  </div>`;
}

function kartHTML(o, { hizliEkle = true } = {}) {
  const k = kayit(o.id);
  const durumIsaret = k?.durum ? `<span class="durum-isaret durum-${k.durum}" title="${DURUMLAR[k.durum].ad}">${DURUMLAR[k.durum].kisa}</span>` : "";
  const hizli = !k?.durum && hizliEkle ? `<button class="hizli-ekle" data-hizli="${kacis(o.id)}" title="İzlenecekler listesine ekle" aria-label="${kacis(o.ad)} izlenecek listesine ekle">＋</button>` : "";
  let ilerleme = "";
  if (o.tip === "dizi" && k?.izlenenBolum && k.durum !== "izledim") {
    const yuzde = Math.min(100, (k.izlenenBolum / toplamBolum(o)) * 100);
    ilerleme = `<span class="ilerleme"><i style="width:${yuzde}%"></i></span>`;
  }
  const alt = [];
  if (k?.puan) alt.push(`<span class="yildiz">★ ${k.puan}</span>`);
  if (k?.favori) alt.push(`<span class="kalp">♥</span>`);
  if (o.tip === "dizi" && k?.izlenenBolum && k.durum !== "izledim") alt.push(`<span>${k.izlenenBolum}/${toplamBolum(o)} bölüm</span>`);
  if (o.tmdbPuan && !k?.puan) alt.push(`<span class="tmdb-puan">★ ${o.tmdbPuan}</span>`);
  else alt.push(`<span>${kacis(o.yil || "")}${o.tip === "film" && o.sure ? " · " + o.sure + " dk" : ""}${o.tip === "dizi" && o.sezon ? " · " + o.sezon + " sezon" : ""}</span>`);
  return `<article class="kart" tabindex="0" data-id="${kacis(o.id)}" aria-label="${kacis(o.ad)}">
    <div style="position:relative">${afisHTML(o)}${durumIsaret}${hizli}${ilerleme}</div>
    <div class="kart-bilgi"><div class="kart-ad">${kacis(o.ad)}</div><div class="kart-alt">${alt.join("")}</div></div>
  </article>`;
}

// ═════════ Yönlendirme ═════════
const SAYFALAR = ["kesfet", "listem", "cark", "istatistik"];
function git(sayfa) {
  if (!SAYFALAR.includes(sayfa)) sayfa = "kesfet";
  SAYFALAR.forEach((s) => ($("#sayfa-" + s).hidden = s !== sayfa));
  $$(".sekme").forEach((b) => b.classList.toggle("aktif", b.dataset.git === sayfa));
  if (location.hash !== "#" + sayfa) history.replaceState(null, "", "#" + sayfa);
  if (sayfa === "kesfet") renderKesfet();
  if (sayfa === "listem") renderListe();
  if (sayfa === "istatistik") renderIstatistik();
  window.scrollTo({ top: 0 });
}
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-git]");
  if (g) { e.preventDefault(); git(g.dataset.git); }
});
window.addEventListener("hashchange", () => git(location.hash.slice(1)));

// ═════════ Keşfet ═════════
const filtre = { q: "", tip: "hepsi", tur: "", sirala: "onerilen" };
function turSecDoldur() {
  const sec = $("#turSec");
  const kullanilan = new Set(tumOgeler().flatMap((o) => o.turler || []));
  sec.innerHTML = `<option value="">Tüm türler</option>` + TURLER.filter((t) => kullanilan.has(t)).map((t) => `<option>${t}</option>`).join("");
  sec.value = filtre.tur;
}
function renderKesfet() {
  const q = sadeles(filtre.q);
  let liste = tumOgeler().filter((o) => {
    if (filtre.tip !== "hepsi" && o.tip !== filtre.tip) return false;
    if (filtre.tur && !(o.turler || []).includes(filtre.tur)) return false;
    if (q && !sadeles(`${o.ad} ${o.orijinal || ""} ${o.yil || ""}`).includes(q)) return false;
    return true;
  });
  const sure = (o) => (o.tip === "film" ? o.sure || 999 : o.bolumDk || 999);
  if (filtre.sirala === "yeni") liste.sort((a, b) => (b.yil || 0) - (a.yil || 0));
  if (filtre.sirala === "eski") liste.sort((a, b) => (a.yil || 0) - (b.yil || 0));
  if (filtre.sirala === "ad") liste.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  if (filtre.sirala === "kisa") liste.sort((a, b) => sure(a) - sure(b));
  if (filtre.sirala === "puan") liste.sort((a, b) => (kayit(b.id)?.puan || 0) - (kayit(a.id)?.puan || 0));
  $("#kesfetIzgara").innerHTML = liste.map((o) => kartHTML(o)).join("");
  $("#kesfetBos").hidden = liste.length > 0 || !!D.tmdb;
  $("#katalogSayac").textContent = liste.length ? `${liste.length} yapım` : "";
  $("#internettenAra").hidden = !filtre.q.trim() || !!D.tmdb;
  $("#internettenAraYazi").textContent = filtre.q.trim();
  const listede = Object.values(D.kayit).filter((k) => k.durum).length;
  $("#karsilamaAlt").textContent = listede
    ? `Katalogda ${tumOgeler().length} yapım var, ${listede} tanesi listende.`
    : `Katalogda ${tumOgeler().length} yapım var. Beğendiğini ＋ ile listene ekle.`;
}
$("#aramaKutu").addEventListener("input", (e) => { filtre.q = e.target.value; renderKesfet(); tmdbYenile(450); });
$("#tipCipler").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tip]"); if (!b) return;
  filtre.tip = b.dataset.tip;
  $$("#tipCipler .cip").forEach((c) => c.classList.toggle("aktif", c === b));
  renderKesfet(); tmdbYenile();
});
$("#turSec").addEventListener("change", (e) => { filtre.tur = e.target.value; renderKesfet(); tmdbYenile(); });
$("#siralaSec").addEventListener("change", (e) => { filtre.sirala = e.target.value; renderKesfet(); tmdbYenile(); });

// Kartlara tıklama (tüm ızgaralar için ortak)
document.addEventListener("click", (e) => {
  const h = e.target.closest("[data-hizli]");
  if (h) { e.stopPropagation(); durumDegistir(h.dataset.hizli, "izlenecek"); bildirim("İzlenecekler listesine eklendi"); return; }
  const k = e.target.closest(".kart[data-id]");
  if (k) detayAc(k.dataset.id);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches?.(".kart[data-id]")) detayAc(e.target.dataset.id);
});

// ═════════ Listem ═════════
let aktifListe = "izliyorum";
const LISTE_BOS = {
  izliyorum: "Şu an izlediğin bir şey yok. Bir dizi başlat, bölümlerini buradan takip et.",
  izlenecek: "İzlenecek listen boş. Keşfet'te beğendiklerine ＋ bas.",
  izledim: "Henüz izledim olarak işaretlediğin bir şey yok.",
  birakildi: "Yarım bıraktığın bir şey yok. Helal olsun.",
  favori: "Favorin yok. Detay penceresindeki ♥ ile ekleyebilirsin.",
};
function listeOgeleri(ad) {
  return tumOgeler()
    .filter((o) => { const k = kayit(o.id); return k && (ad === "favori" ? k.favori : k.durum === ad); })
    .sort((a, b) => {
      const ka = kayit(a.id), kb = kayit(b.id);
      return (kb.izlenme || kb.eklenme || 0) - (ka.izlenme || ka.eklenme || 0);
    });
}
function renderListe() {
  $$("#listeCipler .cip").forEach((c) => {
    c.classList.toggle("aktif", c.dataset.liste === aktifListe);
    c.querySelector("b").textContent = listeOgeleri(c.dataset.liste).length || "";
  });
  const liste = listeOgeleri(aktifListe);
  $("#listeIzgara").innerHTML = liste.map((o) => kartHTML(o, { hizliEkle: false })).join("");
  $("#listeBos").hidden = liste.length > 0;
  $("#listeBosYazi").textContent = LISTE_BOS[aktifListe];
}
$("#listeCipler").addEventListener("click", (e) => {
  const b = e.target.closest("[data-liste]"); if (!b) return;
  aktifListe = b.dataset.liste; renderListe();
});

// ═════════ Durum değişiklikleri ═════════
function durumDegistir(id, yeni) {
  const o = ogeBul(id); if (!o) return;
  const k = kayitOlustur(id);
  const eski = k.durum;
  k.durum = k.durum === yeni ? null : yeni;
  if (k.durum && !eski) k.eklenme = Date.now();
  if (k.durum === "izledim") {
    k.izlenme = Date.now();
    if (o.tip === "dizi") k.izlenenBolum = toplamBolum(o);
    const saat = new Date().getHours();
    if (saat < 5) D.ekstra.geceKusu = true;
  } else if (eski === "izledim") {
    delete k.izlenme;
  }
  kayitTemizle(id);
  degisti();
}
function puanVer(id, p) {
  const k = kayitOlustur(id);
  k.puan = k.puan === p ? 0 : p;
  kayitTemizle(id); degisti();
}
function favoriDegistir(id) {
  const k = kayitOlustur(id); k.favori = !k.favori; kayitTemizle(id); degisti();
}
function bolumDegistir(id, fark) {
  const o = ogeBul(id); const k = kayitOlustur(id);
  const toplam = toplamBolum(o);
  const yeni = Math.max(0, Math.min(toplam, (k.izlenenBolum || 0) + fark));
  if (yeni === k.izlenenBolum) return;
  if (fark > 0) k.bolumZaman.push(Date.now()); else k.bolumZaman.pop();
  k.izlenenBolum = yeni;
  if (yeni > 0 && (!k.durum || k.durum === "izlenecek")) { k.durum = "izliyorum"; k.eklenme = k.eklenme || Date.now(); }
  if (yeni === toplam && k.durum !== "izledim") {
    k.durum = "izledim"; k.izlenme = Date.now();
    if (new Date().getHours() < 5) D.ekstra.geceKusu = true;
    bildirim(`${o.ad} bitti! 🎉 İzledim listesine taşındı.`);
  } else if (yeni < toplam && k.durum === "izledim") {
    k.durum = "izliyorum"; delete k.izlenme;
  }
  degisti();
}

function degisti() {
  kaydet();
  rozetKontrol();
  const acik = SAYFALAR.find((s) => !$("#sayfa-" + s).hidden);
  if (acik === "kesfet") renderKesfet();
  if (acik === "listem") renderListe();
  if (acik === "istatistik") renderIstatistik();
  if ($("#detayPencere").open) detayCiz($("#detayPencere").dataset.id);
}

// ═════════ Detay penceresi ═════════
function detayAc(id) {
  const p = $("#detayPencere");
  p.dataset.id = id;
  detayCiz(id);
  if (!p.open) p.showModal();
  const o = ogeBul(id);
  if (o?.tmdbOn && !o.ayrintili) ayrintiTamamla(o);
}
// TMDB listesinden gelen yapımın süresini, bölüm sayısını ve IMDb kimliğini sonradan getirir
async function ayrintiTamamla(o) {
  try {
    const t = await tmdbAyrinti({ kimlik: o.tmdbKimlik, tip: o.tip, yil: o.yil, afis: o.afis });
    const ek = { ...t, id: o.id, ayrintili: true };
    if (!ek.ozet) delete ek.ozet;
    Object.assign(o, ek);
    const kalici = D.ozel.find((x) => x.id === o.id);
    if (kalici && kalici !== o) { Object.assign(kalici, ek); kaydet(); }
    if (gecici.has(o.id)) Object.assign(gecici.get(o.id), ek);
    if ($("#detayPencere").open && $("#detayPencere").dataset.id === o.id) detayCiz(o.id);
  } catch { /* ayrıntı gelmezse liste bilgisiyle devam */ }
}
function detayCiz(id) {
  const o = ogeBul(id); if (!o) return;
  const k = kayit(id) || {};
  const etiketler = [o.tip === "dizi" ? "Dizi" : "Film", o.yil, sureMetni(o), ...(o.turler || [])].filter(Boolean);
  const yildizlar = Array.from({ length: 10 }, (_, i) => `<button data-puan="${i + 1}" class="${k.puan > i ? "dolu" : ""}" aria-label="${i + 1} puan">★</button>`).join("");
  let bolumBlok = "";
  if (o.tip === "dizi") {
    const toplam = toplamBolum(o);
    const izlenen = k.izlenenBolum || 0;
    bolumBlok = `<div class="detay-bolum"><h4>Bölüm takibi</h4>
      <div class="bolum-takip">
        <div class="sayac"><button data-bolum="-1" aria-label="Bir bölüm geri">−</button><output>${izlenen} / ${toplam}</output><button data-bolum="1" aria-label="Bir bölüm izledim">＋</button></div>
        <div class="bolum-cubuk"><i style="width:${(izlenen / toplam) * 100}%"></i></div>
      </div>
      <div class="bolum-not">Toplam bölüm yanlışsa <button data-toplam>düzelt</button>.${izlenen ? ` Kalan yaklaşık ${Math.round(((toplam - izlenen) * (o.bolumDk || 45)) / 60)} saat.` : ""}</div>
    </div>`;
  }
  const ozelMi = D.ozel.some((x) => x.id === id);
  $("#detayIcerik").innerHTML = `
    <button class="ikon-dugme kapat" data-kapat aria-label="Kapat">✕</button>
    <div class="detay-duzen">
      ${afisHTML(o)}
      <div class="detay-sag">
        <h2>${kacis(o.ad)}</h2>
        ${o.orijinal && o.orijinal !== o.ad ? `<p class="detay-orijinal">${kacis(o.orijinal)}</p>` : ""}
        <div class="etiketler">${etiketler.map((t) => `<span class="etiket">${kacis(t)}</span>`).join("")}</div>
        ${o.ozet ? `<p class="detay-ozet">${kacis(o.ozet)}</p>` : ""}
        <div class="detay-bolum"><h4>Durum</h4>
          <div class="durum-secici">${Object.entries(DURUMLAR).map(([d, v]) => `<button data-durum="${d}" class="${k.durum === d ? "aktif" : ""}"><span>${v.simge}</span>${v.ad}</button>`).join("")}</div>
        </div>
        ${bolumBlok}
        <div class="detay-bolum"><h4>Puanın</h4>
          <div class="puan-yildizlar">${yildizlar}<span class="puan-deger">${k.puan ? k.puan + "/10" : "—"}</span></div>
        </div>
        <div class="detay-bolum"><h4>Notun</h4>
          <textarea id="notAlan" rows="2" maxlength="500" placeholder="Kimle izledin, ne düşündün?">${kacis(k.not || "")}</textarea>
        </div>
        <div class="detay-alt">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="dugme fav-dugme ${k.favori ? "aktif" : ""}" data-favori>${k.favori ? "♥ Favoride" : "♡ Favori"}</button>
            <a class="dugme" href="${kacis(imdbAdresi(o))}" target="_blank" rel="noopener noreferrer">IMDb'de aç ↗</a>
          </div>
          ${ozelMi ? `<button class="dugme tehlike" data-sil>Kataloğumdan sil</button>` : ""}
        </div>
      </div>
    </div>`;
}
$("#detayPencere").addEventListener("click", (e) => {
  const p = $("#detayPencere"); const id = p.dataset.id;
  if (e.target === p || e.target.closest("[data-kapat]")) { p.close(); return; }
  const d = e.target.closest("[data-durum]"); if (d) return durumDegistir(id, d.dataset.durum);
  const pu = e.target.closest("[data-puan]"); if (pu) return puanVer(id, +pu.dataset.puan);
  const b = e.target.closest("[data-bolum]"); if (b) return bolumDegistir(id, +b.dataset.bolum);
  if (e.target.closest("[data-favori]")) return favoriDegistir(id);
  if (e.target.closest("[data-toplam]")) {
    const o = ogeBul(id);
    const cevap = prompt(`${o.ad} toplam kaç bölüm?`, toplamBolum(o));
    const n = parseInt(cevap, 10);
    if (n > 0 && n < 5000) {
      const k = kayitOlustur(id); k.toplamBolum = n;
      if (k.izlenenBolum > n) k.izlenenBolum = n;
      degisti();
    }
    return;
  }
  if (e.target.closest("[data-sil]")) {
    const o = ogeBul(id);
    if (!confirm(`"${o.ad}" kataloğundan ve listenden silinsin mi?`)) return;
    D.ozel = D.ozel.filter((x) => x.id !== id);
    delete D.kayit[id];
    p.close(); turSecDoldur(); degisti();
    bildirim("Silindi");
  }
});
let notZamanlayici;
$("#detayPencere").addEventListener("input", (e) => {
  if (e.target.id !== "notAlan") return;
  const id = $("#detayPencere").dataset.id;
  const k = kayitOlustur(id); k.not = e.target.value;
  clearTimeout(notZamanlayici);
  notZamanlayici = setTimeout(() => { kayitTemizle(id); kaydet(); }, 400);
});
$("#detayPencere").addEventListener("close", () => { kaydet(); });

// ═════════ Ekle: internetten kapakla ya da elle ═════════
const ekleTurSecili = new Set();
function ekleAc(sorgu = "") {
  const p = $("#eklePencere");
  $("#ekleForm").reset();
  ekleTurSecili.clear();
  ekleTurleriCiz();
  tipAlanlari();
  $("#elleBolum").hidden = true;
  $("#elleAcDugme").hidden = false;
  $("#aramaSonuc").innerHTML = "";
  $("#webArama").value = sorgu;
  kaynakNotu();
  p.showModal();
  if (sorgu) webAra(sorgu); else setTimeout(() => $("#webArama").focus(), 50);
}
function ekleTurleriCiz() {
  $("#ekleTurler").innerHTML = TURLER.map((t) => `<button type="button" class="cip ${ekleTurSecili.has(t) ? "aktif" : ""}" data-tur="${t}">${t}</button>`).join("");
}
function tipAlanlari() {
  const dizi = $("#ekleForm").tip.value === "dizi";
  $('[data-alan="film"]').hidden = dizi;
  $('[data-alan="dizi"]').hidden = !dizi;
}
function kaynakNotu() {
  $("#kaynakNotu").innerHTML = D.tmdb
    ? `Film ve diziler TMDB'den Türkçe aranıyor.`
    : `Diziler TVmaze'den kapaklı geliyor. Filmlerin de gelmesi için <button type="button" class="bag" data-ayarlara>ücretsiz TMDB anahtarı ekle</button>.`;
}
$("#ekleTurler").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tur]"); if (!b) return;
  const t = b.dataset.tur;
  ekleTurSecili.has(t) ? ekleTurSecili.delete(t) : ekleTurSecili.add(t);
  b.classList.toggle("aktif");
});
$("#ekleForm").tip.addEventListener("change", tipAlanlari);
$("#eklePencere").addEventListener("click", (e) => {
  if (e.target === $("#eklePencere") || e.target.closest("[data-kapat]")) $("#eklePencere").close();
  if (e.target.closest("[data-ayarlara]")) { $("#eklePencere").close(); ayarlarAc(true); }
});
$("#elleAcDugme").addEventListener("click", () => {
  $("#elleBolum").hidden = false; $("#elleAcDugme").hidden = true;
  const q = $("#webArama").value.trim();
  if (q && !$("#ekleForm").ad.value) $("#ekleForm").ad.value = q;
  $("#ekleForm").ad.focus();
});
$("#ekleForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.ad.value.trim()) { $("#elleBolum").hidden = false; f.ad.focus(); return; }
  const n = (v) => { const x = parseInt(v, 10); return Number.isFinite(x) && x > 0 ? x : undefined; };
  const o = {
    id: "ozel-" + Date.now().toString(36),
    ad: f.ad.value.trim().slice(0, 80),
    tip: f.tip.value === "dizi" ? "dizi" : "film",
    yil: n(f.yil.value),
    turler: [...ekleTurSecili],
    ozet: f.ozet.value.trim().slice(0, 240),
    afis: guvenliUrl(f.afis.value.trim()),
  };
  if (o.tip === "film") o.sure = n(f.sure.value);
  else { o.sezon = n(f.sezon.value); o.bolum = n(f.bolum.value) || 1; o.bolumDk = n(f.bolumDk.value); }
  ozelEkle(o);
});
function ozelEkle(o, { sessiz = false } = {}) {
  D.ozel.unshift(o);
  const k = kayitOlustur(o.id); k.durum = "izlenecek"; k.eklenme = Date.now();
  $("#eklePencere").close();
  turSecDoldur(); degisti();
  if (!sessiz) bildirim(`${o.ad} kataloğa ve İzlenecek listene eklendi`);
  detayAc(o.id);
}

// ——— İnternet araması ———
const TVMAZE_TUR = { Action: "Aksiyon", Adventure: "Macera", Anime: "Animasyon", Comedy: "Komedi", Drama: "Dram", Crime: "Suç", Thriller: "Gerilim", Horror: "Korku", Mystery: "Gizem", "Science-Fiction": "Bilim Kurgu", Fantasy: "Fantastik", Supernatural: "Fantastik", Romance: "Romantik", Family: "Aile", Children: "Aile", Music: "Müzik", History: "Tarih", War: "Savaş", Espionage: "Gerilim", Western: "Macera", Medical: "Dram", Legal: "Dram" };
const TMDB_TUR = { "Aksiyon": ["Aksiyon"], "Macera": ["Macera"], "Animasyon": ["Animasyon"], "Komedi": ["Komedi"], "Suç": ["Suç"], "Belgesel": ["Belgesel"], "Dram": ["Dram"], "Aile": ["Aile"], "Fantastik": ["Fantastik"], "Tarih": ["Tarih"], "Korku": ["Korku"], "Müzik": ["Müzik"], "Gizem": ["Gizem"], "Romantik": ["Romantik"], "Bilim-Kurgu": ["Bilim Kurgu"], "Bilim Kurgu": ["Bilim Kurgu"], "Gerilim": ["Gerilim"], "Savaş": ["Savaş"], "Vahşi Batı": ["Macera"], "Aksiyon & Macera": ["Aksiyon", "Macera"], "Bilim Kurgu & Fantazi": ["Bilim Kurgu", "Fantastik"], "Savaş & Politik": ["Savaş"], "Çocuklar": ["Aile"], "Kids": ["Aile"], "Action & Adventure": ["Aksiyon", "Macera"], "Sci-Fi & Fantasy": ["Bilim Kurgu", "Fantastik"] };
const yalinMetin = (html) => (new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || "").trim();
const kisalt = (s, n = 240) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const turEsle = (liste, tablo) => [...new Set(liste.flatMap((t) => [].concat(tablo[t] || [])))].filter((t) => TURLER.includes(t)).slice(0, 3);

async function tmdbIstek(yol, parametre = {}) {
  const anahtar = D.tmdb.trim();
  const url = new URL("https://api.themoviedb.org/3" + yol);
  Object.entries({ language: "tr-TR", ...parametre }).forEach(([a, v]) => { if (v !== "" && v != null) url.searchParams.set(a, v); });
  const basliklar = { accept: "application/json" };
  if (anahtar.startsWith("eyJ")) basliklar.Authorization = "Bearer " + anahtar; else url.searchParams.set("api_key", anahtar);
  const yanit = await fetch(url, { headers: basliklar });
  if (yanit.status === 401) throw new Error("TMDB anahtarı geçersiz görünüyor.");
  if (!yanit.ok) throw new Error("TMDB yanıt vermedi (" + yanit.status + ")");
  return yanit.json();
}
const tmdbAfis = (yol, boy = "w500") => (yol ? `https://image.tmdb.org/t/p/${boy}${yol}` : "");
// Afişlerde orijinal hali: yerli yapımda Türkçe, diğerlerinde orijinal (İngilizce) afiş. Ad ve özet Türkçe kalır.
const afisDili = (dil) => (dil === "tr" ? "tr" : "en");
function orijinalAfisSec(afisler, dil) {
  const istenen = afisDili(dil);
  const liste = afisler || [];
  return (liste.find((a) => a.iso_639_1 === istenen) || liste.find((a) => a.iso_639_1 === dil) || liste.find((a) => !a.iso_639_1) || liste[0])?.file_path || "";
}
async function tmdbOrijinalAfis(tip, kimlik, dil) {
  const veri = await tmdbIstek(`/${tip === "dizi" ? "tv" : "movie"}/${kimlik}/images`, { language: "", include_image_language: `${afisDili(dil)},${dil || "en"},null` });
  return orijinalAfisSec(veri.posters, dil);
}

async function tvmazeAra(q) {
  const yanit = await fetch("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(q));
  if (!yanit.ok) throw new Error("TVmaze yanıt vermedi");
  const veri = await yanit.json();
  return veri.slice(0, 8).map(({ show: s }) => ({
    kaynak: "tvmaze", kimlik: s.id, tip: "dizi",
    ad: s.name, yil: s.premiered ? +s.premiered.slice(0, 4) : undefined,
    afisKucuk: guvenliUrl(s.image?.medium), afis: guvenliUrl(s.image?.original || s.image?.medium), imdb: s.externals?.imdb || undefined,
    alt: [s.premiered?.slice(0, 4), s.network?.name || s.webChannel?.name, turEsle(s.genres || [], TVMAZE_TUR).slice(0, 2).join(", ")].filter(Boolean).join(" · "),
  }));
}
async function tmdbAra(q) {
  const [veri, ingilizce] = await Promise.all([
    tmdbIstek("/search/multi", { query: q, include_adult: "false" }),
    tmdbIstek("/search/multi", { query: q, include_adult: "false", language: "en-US" }).catch(() => ({ results: [] })),
  ]);
  const enAfis = new Map((ingilizce.results || []).map((r) => [`${r.media_type}${r.id}`, r.poster_path]));
  (veri.results || []).forEach((r) => { const en = enAfis.get(`${r.media_type}${r.id}`); if (r.original_language !== "tr" && en) r.poster_path = en; });
  return (veri.results || []).filter((r) => r.media_type === "movie" || r.media_type === "tv").slice(0, 10).map((r) => {
    const tarih = r.release_date || r.first_air_date || "";
    return {
      kaynak: "tmdb", kimlik: r.id, tip: r.media_type === "tv" ? "dizi" : "film",
      ad: r.title || r.name, orijinal: r.original_title || r.original_name, yil: tarih ? +tarih.slice(0, 4) : undefined,
      afisKucuk: tmdbAfis(r.poster_path, "w185"), afis: tmdbAfis(r.poster_path),
      alt: [r.media_type === "tv" ? "Dizi" : "Film", tarih.slice(0, 4), r.vote_average ? "★ " + r.vote_average.toFixed(1) : ""].filter(Boolean).join(" · "),
    };
  });
}
let sonAramaNo = 0;
async function webAra(q) {
  q = q.trim(); if (!q) return;
  const no = ++sonAramaNo;
  const kutu = $("#aramaSonuc");
  kutu.innerHTML = `<p class="arama-durum">Aranıyor…</p>`;
  try {
    const sonuc = D.tmdb ? await tmdbAra(q) : await tvmazeAra(q);
    if (no !== sonAramaNo) return;
    window.__aramaSonuc = sonuc;
    if (!sonuc.length) {
      kutu.innerHTML = `<p class="arama-durum">Bir şey bulamadım.${D.tmdb ? "" : " Film arıyorsan TMDB anahtarı gerekiyor; ya da aşağıdan elle ekle."}</p>`;
      return;
    }
    kutu.innerHTML = sonuc.map((s, i) => `<button type="button" class="sonuc" data-sonuc="${i}">
      <span class="sonuc-afis">${s.afisKucuk ? `<img src="${kacis(s.afisKucuk)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "🎬"}</span>
      <span class="sonuc-yazi"><b>${kacis(s.ad)}</b>${s.orijinal && s.orijinal !== s.ad ? `<i>${kacis(s.orijinal)}</i>` : ""}<small>${kacis(s.alt)}</small></span>
      <span class="sonuc-ekle">＋ Ekle</span>
    </button>`).join("");
  } catch (hata) {
    if (no !== sonAramaNo) return;
    kutu.innerHTML = `<p class="arama-durum hata">${kacis(hata.message || "Arama başarısız oldu. İnternet bağlantını kontrol et.")}</p>`;
  }
}
let aramaZamanlayici;
$("#webArama").addEventListener("input", (e) => {
  clearTimeout(aramaZamanlayici);
  const q = e.target.value;
  if (q.trim().length < 2) { $("#aramaSonuc").innerHTML = ""; return; }
  aramaZamanlayici = setTimeout(() => webAra(q), 450);
});
$("#webArama").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(aramaZamanlayici); webAra(e.target.value); } });

$("#aramaSonuc").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-sonuc]"); if (!b) return;
  const s = window.__aramaSonuc?.[+b.dataset.sonuc]; if (!s) return;
  // Zaten katalogda mı?
  const mevcut = tumOgeler().find((o) => {
    if (o.kaynak && o.kaynak === `${s.kaynak}:${s.kimlik}`) return true;
    if (s.imdb && (o.imdb || D.imdb[o.id]) === s.imdb) return true;
    if (o.tip !== s.tip || (o.yil && s.yil && Math.abs(o.yil - s.yil) > 1)) return false;
    const bizim = [sadeles(o.ad), sadeles(o.orijinal)].filter(Boolean);
    const onlar = [sadeles(s.ad), sadeles(s.orijinal)].filter(Boolean);
    // "Arcane" ile "Arcane: League of Legends" gibi alt başlıklı adları da aynı say (yıl tutuyorsa)
    return bizim.some((a) => onlar.some((b) => a === b || (o.yil && s.yil && (b.startsWith(a + " ") || a.startsWith(b + " ")))));
  });
  if (mevcut) {
    if (s.afis && !afisAdresi(mevcut)) { D.afisler[mevcut.id] = s.afis; }
    const k = kayitOlustur(mevcut.id); if (!k.durum) { k.durum = "izlenecek"; k.eklenme = Date.now(); }
    $("#eklePencere").close(); degisti();
    bildirim(`${mevcut.ad} zaten katalogdaydı, listene eklendi`);
    detayAc(mevcut.id);
    return;
  }
  b.classList.add("yukleniyor");
  b.querySelector(".sonuc-ekle").textContent = "Ekleniyor…";
  try {
    const o = s.kaynak === "tmdb" ? await tmdbAyrinti(s) : await tvmazeAyrinti(s);
    ozelEkle(o);
  } catch (hata) {
    b.classList.remove("yukleniyor");
    b.querySelector(".sonuc-ekle").textContent = "＋ Ekle";
    bildirim(hata.message || "Ayrıntılar alınamadı");
  }
});
async function tvmazeAyrinti(s) {
  const yanit = await fetch(`https://api.tvmaze.com/shows/${s.kimlik}?embed=episodes`);
  if (!yanit.ok) throw new Error("Dizi ayrıntıları alınamadı");
  const d = await yanit.json();
  const bolumler = d._embedded?.episodes || [];
  return {
    id: "ozel-" + Date.now().toString(36), kaynak: `tvmaze:${d.id}`, tip: "dizi",
    ad: d.name, orijinal: d.name, yil: d.premiered ? +d.premiered.slice(0, 4) : undefined,
    turler: turEsle(d.genres || [], TVMAZE_TUR),
    sezon: new Set(bolumler.map((b) => b.season)).size || undefined,
    bolum: bolumler.length || 1,
    bolumDk: d.averageRuntime || d.runtime || undefined,
    afis: guvenliUrl(d.image?.original || d.image?.medium),
    imdb: d.externals?.imdb || undefined,
    ozet: kisalt(yalinMetin(d.summary)),
  };
}
async function tmdbAyrinti(s) {
  const tv = s.tip === "dizi";
  const d = await tmdbIstek(`/${tv ? "tv" : "movie"}/${s.kimlik}`, { append_to_response: "external_ids,images", include_image_language: "en,tr,null" });
  const orijinalYol = orijinalAfisSec(d.images?.posters, d.original_language);
  const o = {
    id: "ozel-" + Date.now().toString(36), kaynak: `tmdb:${s.kimlik}`, tip: s.tip,
    ad: d.title || d.name, orijinal: d.original_title || d.original_name,
    yil: s.yil, turler: turEsle((d.genres || []).map((g) => g.name), TMDB_TUR),
    afis: tmdbAfis(orijinalYol || d.poster_path) || s.afis,
    imdb: d.imdb_id || d.external_ids?.imdb_id || undefined,
    ozet: kisalt(d.overview || ""),
  };
  if (tv) { o.sezon = d.number_of_seasons; o.bolum = d.number_of_episodes || 1; o.bolumDk = d.episode_run_time?.[0] || undefined; }
  else o.sure = d.runtime || undefined;
  return o;
}

$("#ekleDugme").addEventListener("click", () => ekleAc());
$("#bosEkle").addEventListener("click", () => ekleAc(filtre.q));
$("#internettenAra").addEventListener("click", () => ekleAc(filtre.q));

// ——— Katalog kapaklarını otomatik bulma ———
let kapakCalisiyor = false;
async function katalogKapaklari({ zorla = false } = {}) {
  if (kapakCalisiyor) return;
  kapakCalisiyor = true;
  const kaynak = D.tmdb ? "tmdb" : "tvmaze";
  const adaylar = KATALOG.filter((o) => !D.afisler[o.id] && (kaynak === "tmdb" || o.tip === "dizi") && (zorla || !D.afisDenendi[`${kaynak}:${o.id}`]));
  let bulunan = 0;
  for (const o of adaylar) {
    try {
      const sonuc = kaynak === "tmdb" ? await tmdbKapak(o) : await tvmazeKapak(o);
      D.afisDenendi[`${kaynak}:${o.id}`] = true;
      if (sonuc?.afis) {
        D.afisler[o.id] = sonuc.afis;
        if (sonuc.imdb) D.imdb[o.id] = sonuc.imdb;
        bulunan++;
        kartAfisiniYenile(o);
      }
      kaydet();
    } catch (hata) {
      if (/anahtar/.test(hata.message)) { bildirim(hata.message); break; }
      // ağ hatası: denendi olarak işaretleme, sonra tekrar dener
    }
    await bekle(kaynak === "tmdb" ? 120 : 550);
  }
  kapakCalisiyor = false;
  return bulunan;
}
async function tvmazeKapak(o) {
  // Önce orijinal adla, olmazsa Türkçe/katalog adıyla ara; yılı tutan ilk sonucu seç.
  const adlar = [...new Set([o.orijinal, o.ad].filter(Boolean))];
  for (const ad of adlar) {
    const yanit = await fetch("https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(ad));
    if (!yanit.ok) throw new Error("ag");
    const sonuc = (await yanit.json()).map((r) => r.show);
    const uyan = sonuc.find((d) => {
      const yil = d.premiered ? +d.premiered.slice(0, 4) : 0;
      return d.image && (!o.yil || !yil || Math.abs(yil - o.yil) <= 1);
    });
    if (uyan) return { afis: guvenliUrl(uyan.image.original || uyan.image.medium), imdb: uyan.externals?.imdb, ad: uyan.name };
    await bekle(300);
  }
  return null;
}
async function tmdbKapak(o) {
  // İlk sonucu körü körüne alma: yılı tutan (±1) ve kapağı olan sonucu seç; adı da tutanı öne al.
  const tv = o.tip === "dizi";
  const yilAl = (r) => +((r.release_date || r.first_air_date || "").slice(0, 4)) || 0;
  const adlar = [...new Set([o.orijinal, o.ad].filter(Boolean))];
  for (const ad of adlar) {
    const veri = await tmdbIstek(`/search/${tv ? "tv" : "movie"}`, { query: ad });
    const uygun = (veri.results || []).filter((r) => r.poster_path && (!o.yil || !yilAl(r) || Math.abs(yilAl(r) - o.yil) <= 1));
    const adTutar = (r) => [r.title, r.name, r.original_title, r.original_name].some((x) => x && adlar.some((a) => sadeles(x) === sadeles(a)));
    const secilen = uygun.find(adTutar) || uygun[0];
    if (secilen) {
      const yol = await tmdbOrijinalAfis(o.tip, secilen.id, secilen.original_language).catch(() => "");
      return { afis: tmdbAfis(yol || secilen.poster_path), ad: secilen.title || secilen.name };
    }
  }
  return null;
}
function kartAfisiniYenile(o) {
  $$(`.kart[data-id="${CSS.escape(o.id)}"] .afis`).forEach((eski) => {
    const sar = document.createElement("div"); sar.innerHTML = afisHTML(o);
    eski.replaceWith(sar.firstElementChild);
  });
}

// ═════════ TMDB'de keşfet: sınırsız film/dizi ═════════
const TMDB_FILM_TUR = { "Aksiyon": 28, "Macera": 12, "Animasyon": 16, "Komedi": 35, "Suç": 80, "Belgesel": 99, "Dram": 18, "Aile": 10751, "Fantastik": 14, "Tarih": 36, "Korku": 27, "Müzik": 10402, "Gizem": 9648, "Romantik": 10749, "Bilim Kurgu": 878, "Gerilim": 53, "Savaş": 10752 };
const TMDB_DIZI_TUR = { "Aksiyon": 10759, "Macera": 10759, "Animasyon": 16, "Komedi": 35, "Suç": 80, "Belgesel": 99, "Dram": 18, "Aile": 10751, "Gizem": 9648, "Bilim Kurgu": 10765, "Fantastik": 10765, "Savaş": 10768 };
const TMDB_ID_TUR = { 28: "Aksiyon", 12: "Macera", 16: "Animasyon", 35: "Komedi", 80: "Suç", 99: "Belgesel", 18: "Dram", 10751: "Aile", 14: "Fantastik", 36: "Tarih", 27: "Korku", 10402: "Müzik", 9648: "Gizem", 10749: "Romantik", 878: "Bilim Kurgu", 53: "Gerilim", 10752: "Savaş", 10759: "Aksiyon", 10765: "Bilim Kurgu", 10768: "Savaş", 10762: "Aile" };
const tmdb = { sayfa: 0, toplamSayfa: 1, ids: [], yukleniyor: false, no: 0, not: "" };

function tmdbSorgu(sayfa) {
  const q = filtre.q.trim();
  const tv = filtre.tip === "dizi";
  if (q) {
    const yol = filtre.tip === "hepsi" ? "/search/multi" : tv ? "/search/tv" : "/search/movie";
    return [yol, { query: q, page: sayfa, include_adult: "false" }];
  }
  const p = { page: sayfa, include_adult: "false", "vote_count.gte": 40 };
  const bugun = new Date().toISOString().slice(0, 10);
  const tarih = tv ? "first_air_date" : "primary_release_date";
  p.sort_by = { onerilen: "popularity.desc", yeni: `${tarih}.desc`, eski: `${tarih}.asc`, ad: tv ? "name.asc" : "title.asc", kisa: "popularity.desc", puan: "vote_average.desc" }[filtre.sirala] || "popularity.desc";
  if (filtre.sirala === "puan") p["vote_count.gte"] = 800;
  if (filtre.sirala === "eski") p["vote_count.gte"] = 300;
  if (filtre.sirala === "yeni") p[`${tarih}.lte`] = bugun;
  if (filtre.sirala === "kisa" && !tv) p["with_runtime.lte"] = 100;
  if (filtre.tur) p.with_genres = (tv ? TMDB_DIZI_TUR : TMDB_FILM_TUR)[filtre.tur] ?? -1;
  return [tv ? "/discover/tv" : "/discover/movie", p];
}
function tmdbOgeye(r, tipVarsayilan) {
  const tur = r.media_type || tipVarsayilan;
  if (tur !== "movie" && tur !== "tv") return null;
  const tarih = r.release_date || r.first_air_date || "";
  const tip = tur === "tv" ? "dizi" : "film";
  return {
    id: `tmdb-${tur === "tv" ? "t" : "m"}-${r.id}`, kaynak: `tmdb:${r.id}`, tmdbOn: true, tmdbKimlik: r.id, tip,
    ad: r.title || r.name, orijinal: r.original_title || r.original_name, yil: tarih ? +tarih.slice(0, 4) : undefined,
    turler: [...new Set((r.genre_ids || []).map((g) => TMDB_ID_TUR[g]).filter(Boolean))].slice(0, 3),
    afis: tmdbAfis(r.poster_path, "w342"), ozet: kisalt(r.overview || ""),
    tmdbPuan: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
    bolum: tip === "dizi" ? 1 : undefined,
  };
}
function katalogdaVar(o) {
  return tumOgeler().some((x) => x.kaynak === o.kaynak ||
    (x.tip === o.tip && (!x.yil || !o.yil || Math.abs(x.yil - o.yil) <= 1) &&
      [sadeles(x.ad), sadeles(x.orijinal)].some((a) => a && (a === sadeles(o.ad) || a === sadeles(o.orijinal)))));
}
let tmdbZamanlayici;
function tmdbYenile(gecikme = 0) {
  clearTimeout(tmdbZamanlayici);
  tmdbZamanlayici = setTimeout(() => {
    tmdb.no++; tmdb.sayfa = 0; tmdb.toplamSayfa = 1; tmdb.ids = []; tmdb.yukleniyor = false;
    tmdbBaslikYaz(); tmdbCiz(); tmdbDahaFazla();
  }, gecikme);
}
function tmdbBaslikYaz() {
  const q = filtre.q.trim();
  const ne = filtre.tip === "dizi" ? "dizi" : filtre.tip === "film" ? "film" : q ? "film ve dizi" : "film";
  $("#tmdbBaslik").textContent = q ? `TMDB'de “${q}”` : `TMDB'den daha fazla ${ne}`;
  const sira = { onerilen: "popülerliğe göre", yeni: "en yeniler", eski: "en eskiler", ad: "A → Z", kisa: "100 dakikadan kısa", puan: "en yüksek puanlılar" }[filtre.sirala];
  $("#tmdbAlt").textContent = q ? "Sonsuz arşivde arama sonuçları" : `${filtre.tur ? filtre.tur + " · " : ""}${sira}${filtre.tip === "hepsi" ? " · dizi için üstten Dizi'yi seç" : ""}`;
}
async function tmdbDahaFazla() {
  if (!D.tmdb || tmdb.yukleniyor || tmdb.sayfa >= tmdb.toplamSayfa || tmdb.sayfa >= 500) return;
  const [yol, p] = tmdbSorgu(tmdb.sayfa + 1);
  if (p.with_genres === -1) { tmdb.not = `TMDB'de “${filtre.tur}” türünde dizi kategorisi yok.`; tmdb.toplamSayfa = 0; tmdbCiz(); return; }
  tmdb.yukleniyor = true; tmdb.not = ""; tmdbCiz();
  const no = tmdb.no;
  try {
    const [veri, ingilizce] = await Promise.all([
      tmdbIstek(yol, p),
      tmdbIstek(yol, { ...p, language: "en-US" }).catch(() => ({ results: [] })),
    ]);
    if (no !== tmdb.no) return;
    const enAfis = new Map((ingilizce.results || []).map((r) => [`${r.media_type || ""}${r.id}`, r.poster_path]));
    (veri.results || []).forEach((r) => {
      const en = enAfis.get(`${r.media_type || ""}${r.id}`);
      if (r.original_language !== "tr" && en) r.poster_path = en;
    });
    tmdb.sayfa = veri.page || tmdb.sayfa + 1;
    tmdb.toplamSayfa = veri.total_pages || 0;
    const varsayilan = yol.includes("/tv") ? "tv" : "movie";
    for (const r of veri.results || []) {
      const o = tmdbOgeye(r, varsayilan);
      if (!o || !o.afis) continue;
      const kalici = D.ozel.find((x) => x.id === o.id);
      if (!kalici && katalogdaVar(o)) continue;
      if (!kalici && !gecici.has(o.id)) gecici.set(o.id, o);
      if (!tmdb.ids.includes(o.id)) tmdb.ids.push(o.id);
    }
    if (!tmdb.ids.length && tmdb.sayfa >= tmdb.toplamSayfa) tmdb.not = "TMDB'de de bir şey bulamadım.";
  } catch (hata) {
    if (no !== tmdb.no) return;
    tmdb.not = hata.message || "TMDB'ye ulaşılamadı.";
  }
  tmdb.yukleniyor = false;
  tmdbCiz();
  // Ekran hâlâ dolmadıysa bir sayfa daha getir
  if (no === tmdb.no && !tmdb.not && tmdb.ids.length < 12 && tmdb.sayfa < tmdb.toplamSayfa) tmdbDahaFazla();
}
function tmdbCiz() {
  const bolum = $("#tmdbBolum");
  if (!D.tmdb) {
    bolum.hidden = false;
    $("#tmdbIzgara").innerHTML = "";
    $("#tmdbDurum").innerHTML = `<div class="tmdb-davet"><b>Daha fazla film mi istiyorsun?</b><span>Ücretsiz TMDB anahtarını eklersen burada yüz binlerce film ve dizi listelenir.</span><button class="dugme ana" data-ayarlara-git>Anahtarı ekle</button></div>`;
    $("#tmdbDahaDugme").hidden = true;
    return;
  }
  bolum.hidden = false;
  $("#tmdbIzgara").innerHTML = tmdb.ids.map((id) => ogeBul(id)).filter(Boolean).map((o) => kartHTML(o)).join("");
  $("#tmdbDurum").innerHTML = tmdb.yukleniyor ? `<p class="arama-durum">Yükleniyor…</p>` : tmdb.not ? `<p class="arama-durum">${kacis(tmdb.not)}</p>` : "";
  $("#tmdbDahaDugme").hidden = tmdb.yukleniyor || !!tmdb.not || tmdb.sayfa >= tmdb.toplamSayfa || tmdb.sayfa >= 500;
}
$("#tmdbDahaDugme").addEventListener("click", () => tmdbDahaFazla());
document.addEventListener("click", (e) => { if (e.target.closest("[data-ayarlara-git]")) ayarlarAc(true); });
// Aşağı inince kendiliğinden daha fazla yükle
new IntersectionObserver((girdiler) => {
  if (girdiler.some((g) => g.isIntersecting) && !$("#sayfa-kesfet").hidden) tmdbDahaFazla();
}, { rootMargin: "600px" }).observe($("#tmdbGozcu"));

// ═════════ Çark ═════════
const cark = { ruh: "hepsi", vakit: "hepsi", kaynak: "hepsi" };
const RUH_TUR = {
  gerilim: ["Gerilim", "Korku", "Gizem", "Suç"],
  kahkaha: ["Komedi"],
  duygu: ["Dram", "Romantik", "Aile", "Müzik"],
  aksiyon: ["Aksiyon", "Macera", "Savaş"],
  akil: ["Bilim Kurgu", "Gizem", "Fantastik"],
  hafif: ["Komedi", "Animasyon", "Aile", "Macera", "Romantik"],
};
["ruh", "vakit", "kaynak"].forEach((alan) => {
  $(`#${alan}Cipler`).addEventListener("click", (e) => {
    const b = e.target.closest(`[data-${alan}]`); if (!b) return;
    cark[alan] = b.dataset[alan];
    $$(`#${alan}Cipler .cip`).forEach((c) => c.classList.toggle("aktif", c === b));
  });
});
function carkHavuzu() {
  const atla = $("#izlenenleriAtla").checked;
  return tumOgeler().filter((o) => {
    const k = kayit(o.id);
    if (cark.kaynak === "izlenecek" && k?.durum !== "izlenecek") return false;
    if (atla && (k?.durum === "izledim" || k?.durum === "birakildi")) return false;
    if (cark.ruh !== "hepsi" && !(o.turler || []).some((t) => RUH_TUR[cark.ruh].includes(t))) return false;
    if (cark.vakit === "bolum" && !(o.tip === "dizi" && (o.bolumDk || 45) <= 60)) return false;
    if (cark.vakit === "film" && !(o.tip === "film" && (o.sure || 0) <= 120)) return false;
    if (cark.vakit === "uzun" && !(o.tip === "dizi" || (o.sure || 0) > 120)) return false;
    return true;
  });
}
function makaraDoldur(liste) {
  $("#makaraSerit").innerHTML = liste.map((o) => afisHTML(o)).join("");
}
let sonKazanan = null;
$("#cevirDugme").addEventListener("click", () => {
  const havuz = carkHavuzu();
  if (!havuz.length) {
    bildirim(cark.kaynak === "izlenecek" ? "İzlenecek listende bu filtrelere uyan bir şey yok" : "Bu filtrelere uyan bir şey yok, birini gevşet");
    return;
  }
  let kazanan = havuz[Math.floor(Math.random() * havuz.length)];
  if (havuz.length > 1 && kazanan === sonKazanan) kazanan = havuz.find((o) => o !== sonKazanan);
  sonKazanan = kazanan;
  const ADET = 28, KAZANAN_SIRA = 24;
  const serit = Array.from({ length: ADET }, (_, i) => (i === KAZANAN_SIRA ? kazanan : havuz[Math.floor(Math.random() * havuz.length)]));
  const s = $("#makaraSerit");
  s.style.transition = "none"; s.style.transform = "translateX(0)";
  makaraDoldur(serit);
  const afis = s.firstElementChild;
  const gen = afis.getBoundingClientRect().width;
  const bosluk = parseFloat(getComputedStyle(s).columnGap) || 16;
  const makaraGen = $("#makara").getBoundingClientRect().width;
  const hedef = -(KAZANAN_SIRA * (gen + bosluk)) + makaraGen / 2 - gen / 2;
  const sapma = (Math.random() - 0.5) * gen * 0.5;
  s.getBoundingClientRect();
  const dugme = $("#cevirDugme"); dugme.disabled = true; dugme.textContent = "Dönüyor…";
  $("#carkSonuc").hidden = true;
  const azalt = matchMedia("(prefers-reduced-motion: reduce)").matches;
  s.style.transition = azalt ? "transform .3s ease" : "transform 3.4s cubic-bezier(.12,.72,.14,1)";
  s.style.transform = `translateX(${hedef + sapma}px)`;
  setTimeout(() => {
    s.style.transition = "transform .45s cubic-bezier(.3,1.4,.5,1)";
    s.style.transform = `translateX(${hedef}px)`;
  }, azalt ? 320 : 3450);
  setTimeout(() => {
    dugme.disabled = false; dugme.textContent = "✦ Tekrar çevir";
    D.ekstra.cevirme = (D.ekstra.cevirme || 0) + 1; kaydet(); rozetKontrol();
    carkSonucGoster(kazanan);
  }, azalt ? 800 : 3950);
});
function carkSonucGoster(o) {
  const k = kayit(o.id);
  const kutu = $("#carkSonuc");
  kutu.innerHTML = `<span class="soluk">Bu akşamın seçimi</span>
    <h3>${kacis(o.ad)}</h3>
    <div class="etiketler">${[o.tip === "dizi" ? "Dizi" : "Film", o.yil, sureMetni(o), ...(o.turler || [])].filter(Boolean).map((t) => `<span class="etiket">${kacis(t)}</span>`).join("")}</div>
    ${o.ozet ? `<p>${kacis(o.ozet)}</p>` : ""}
    <div class="sonuc-dugmeler">
      <button class="dugme ana" data-cark-izle="${kacis(o.id)}">▶ Şimdi izliyorum</button>
      ${k?.durum ? "" : `<button class="dugme" data-cark-sonra="${kacis(o.id)}">＋ Sonraya sakla</button>`}
      <button class="dugme" data-cark-detay="${kacis(o.id)}">Ayrıntılar</button>
    </div>`;
  kutu.hidden = false;
}
$("#carkSonuc").addEventListener("click", (e) => {
  const a = e.target.closest("[data-cark-izle]");
  if (a) { const k = kayitOlustur(a.dataset.carkIzle); if (k.durum !== "izliyorum") durumDegistir(a.dataset.carkIzle, "izliyorum"); bildirim("İyi seyirler! 🍿 İzliyorum listesinde."); return; }
  const s = e.target.closest("[data-cark-sonra]");
  if (s) { durumDegistir(s.dataset.carkSonra, "izlenecek"); bildirim("İzlenecekler listesine eklendi"); s.remove(); return; }
  const d = e.target.closest("[data-cark-detay]");
  if (d) detayAc(d.dataset.carkDetay);
});

// ═════════ İstatistik ═════════
function hesapla() {
  const ogeler = tumOgeler();
  let film = 0, bolum = 0, dakika = 0, dizBitti = 0;
  const turSay = {}, puanlilar = [];
  const aylar = {};
  const ayAnahtar = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}`; };
  for (const o of ogeler) {
    const k = kayit(o.id); if (!k) continue;
    if (k.puan) puanlilar.push({ o, p: k.puan });
    const izlendi = k.durum === "izledim";
    if (o.tip === "film" && izlendi) {
      film++; dakika += o.sure || 110;
      if (k.izlenme) { const a = ayAnahtar(k.izlenme); aylar[a] = (aylar[a] || 0) + (o.sure || 110); }
    }
    if (o.tip === "dizi") {
      const n = k.izlenenBolum || 0;
      bolum += n; dakika += n * (o.bolumDk || 45);
      for (const t of k.bolumZaman || []) { const a = ayAnahtar(t); aylar[a] = (aylar[a] || 0) + (o.bolumDk || 45); }
      if (izlendi) dizBitti++;
    }
    if (izlendi || (o.tip === "dizi" && k.izlenenBolum)) (o.turler || []).forEach((t) => (turSay[t] = (turSay[t] || 0) + 1));
  }
  const ortPuan = puanlilar.length ? puanlilar.reduce((a, b) => a + b.p, 0) / puanlilar.length : 0;
  return { film, bolum, dakika, dizBitti, turSay, puanlilar, ortPuan, aylar };
}
function renderIstatistik() {
  const h = hesapla();
  const saat = Math.round(h.dakika / 60);
  $("#kpiSatir").innerHTML = [
    [h.film, "", "film izledin"],
    [h.bolum, "", "dizi bölümü"],
    [saat, "sa", saat >= 24 ? `ekran başında (≈ ${(h.dakika / 1440).toFixed(1)} gün)` : "ekran başında"],
    [h.ortPuan ? h.ortPuan.toFixed(1) : "—", h.ortPuan ? "/10" : "", "ortalama puanın"],
  ].map(([d, b, e]) => `<div class="kpi"><div class="kpi-deger">${d}<small>${b}</small></div><div class="kpi-etiket">${e}</div></div>`).join("");

  const turler = Object.entries(h.turSay).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const enCok = turler[0]?.[1] || 1;
  $("#turGrafik").innerHTML = turler.length
    ? turler.map(([t, n]) => `<div class="cubuk-satir"><span>${t}</span><span class="iz"><i style="width:${(n / enCok) * 100}%"></i></span><b>${n}</b></div>`).join("")
    : `<p class="bos-yazi">Bir şeyi izledim olarak işaretleyince türlerin burada görünecek.</p>`;

  const simdi = new Date();
  const son6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(simdi.getFullYear(), simdi.getMonth() - 5 + i, 1); return { a: `${d.getFullYear()}-${d.getMonth()}`, ad: AYLAR[d.getMonth()] }; });
  const enFazla = Math.max(60, ...son6.map((x) => h.aylar[x.a] || 0));
  $("#ayGrafik").innerHTML = son6.map((x) => {
    const dk = h.aylar[x.a] || 0;
    return `<div class="ay-sutun" title="${Math.round(dk / 60)} saat"><b>${dk ? Math.round(dk / 60) + "s" : ""}</b><div class="kutu"><i style="height:${(dk / enFazla) * 100}%"></i></div><span>${x.ad}</span></div>`;
  }).join("");

  const enIyi = h.puanlilar.sort((a, b) => b.p - a.p).slice(0, 5);
  $("#enIyiler").innerHTML = enIyi.length
    ? enIyi.map(({ o, p }) => `<li data-detay="${kacis(o.id)}"><span class="ad">${kacis(o.ad)}</span><span class="p">★ ${p}</span></li>`).join("")
    : `<p class="bos-yazi">Puan verdiğin yapımlar burada sıralanacak.</p>`;

  const durumlar = rozetDurumlari();
  const acik = durumlar.filter((r) => r.acik).length;
  $("#rozetSayac").textContent = `${acik} / ${durumlar.length}`;
  $("#rozetIzgara").innerHTML = durumlar.map((r) => `<div class="rozet ${r.acik ? "" : "kilitli"}" title="${kacis(r.aciklama)}">
    <span class="rozet-simge">${r.simge}</span>
    <span style="min-width:0;flex:1"><b>${r.ad}</b><small>${r.aciklama}</small>
    ${r.acik ? "" : `<span class="mini-iz"><i style="width:${Math.min(100, (r.deger / r.hedef) * 100)}%"></i></span>`}</span>
  </div>`).join("");
}
$("#enIyiler").addEventListener("click", (e) => { const li = e.target.closest("[data-detay]"); if (li) detayAc(li.dataset.detay); });

// ═════════ Rozetler ═════════
const ROZETLER = [
  { id: "ilk-adim", simge: "🎬", ad: "İlk adım", aciklama: "Listene ilk yapımı ekle", hesap: () => [Object.values(D.kayit).filter((k) => k.durum).length, 1] },
  { id: "sinefil", simge: "🍿", ad: "Sinefil", aciklama: "10 film izle", hesap: (h) => [h.film, 10] },
  { id: "sinema-kurdu", simge: "🎞️", ad: "Sinema kurdu", aciklama: "50 film izle", hesap: (h) => [h.film, 50] },
  { id: "maratoncu", simge: "📺", ad: "Maratoncu", aciklama: "50 dizi bölümü izle", hesap: (h) => [h.bolum, 50] },
  { id: "bitirici", simge: "🏁", ad: "Bitirici", aciklama: "Bir diziyi baştan sona bitir", hesap: (h) => [h.dizBitti, 1] },
  { id: "elestirmen", simge: "⭐", ad: "Eleştirmen", aciklama: "10 yapıma puan ver", hesap: (h) => [h.puanlilar.length, 10] },
  { id: "kasif", simge: "🧭", ad: "Tür kâşifi", aciklama: "8 farklı türden izle", hesap: (h) => [Object.keys(h.turSay).length, 8] },
  { id: "yerli", simge: "🌙", ad: "Yerli malı", aciklama: "3 yerli yapım izle", hesap: () => [[...YERLI].filter((id) => kayit(id)?.durum === "izledim").length, 3] },
  { id: "zaman-yolcusu", simge: "🕰️", ad: "Zaman yolcusu", aciklama: "1990'dan önceki bir filmi izle", hesap: () => [tumOgeler().filter((o) => o.tip === "film" && o.yil && o.yil < 1990 && kayit(o.id)?.durum === "izledim").length, 1] },
  { id: "gece-kusu", simge: "🦉", ad: "Gece kuşu", aciklama: "Gece 00:00–05:00 arası bir şeyi bitir", hesap: () => [D.ekstra.geceKusu ? 1 : 0, 1] },
  { id: "sansli", simge: "🎰", ad: "Şansına güvenen", aciklama: "Çarkı 10 kez çevir", hesap: () => [D.ekstra.cevirme || 0, 10] },
  { id: "koleksiyoncu", simge: "🗂️", ad: "Koleksiyoncu", aciklama: "Kataloğa kendin 3 yapım ekle", hesap: () => [D.ozel.length, 3] },
  { id: "kalbimin-sahibi", simge: "♥", ad: "Kalbimin sahibi", aciklama: "5 favori seç", hesap: () => [Object.values(D.kayit).filter((k) => k.favori).length, 5] },
  { id: "yuz-saat", simge: "⏳", ad: "Yüz saat", aciklama: "Toplam 100 saat izle", hesap: (h) => [Math.floor(h.dakika / 60), 100] },
];
function rozetDurumlari() {
  const h = hesapla();
  return ROZETLER.map((r) => { const [deger, hedef] = r.hesap(h); return { ...r, deger, hedef, acik: deger >= hedef || D.rozetler.includes(r.id) }; });
}
function rozetKontrol() {
  const yeni = rozetDurumlari().filter((r) => r.acik && !D.rozetler.includes(r.id));
  if (!yeni.length) return;
  yeni.forEach((r, i) => setTimeout(() => bildirim(`${r.simge}  Rozet açıldı: ${r.ad}`, "rozet-bildirim"), i * 700));
  D.rozetler.push(...yeni.map((r) => r.id));
  kaydet();
}

// ═════════ Bildirim ═════════
function bildirim(metin, sinif = "") {
  const b = document.createElement("div");
  b.className = "bildirim " + sinif; b.textContent = metin;
  $("#bildirimler").appendChild(b);
  setTimeout(() => { b.classList.add("gidiyor"); setTimeout(() => b.remove(), 300); }, sinif ? 3200 : 2200);
}

// ═════════ Ayarlar, tema, yedek ═════════
function temaUygula() { document.documentElement.dataset.tema = D.tema === "acik" ? "acik" : "koyu"; }
$("#temaDugme").addEventListener("click", () => { D.tema = D.tema === "acik" ? "koyu" : "acik"; temaUygula(); kaydet(); });

function ayarlarAc(anahtaraOdaklan = false) {
  $("#tmdbAnahtar").value = D.tmdb;
  tmdbDurumYaz();
  $("#yedekPencere").showModal();
  if (anahtaraOdaklan) setTimeout(() => $("#tmdbAnahtar").focus(), 50);
}
function tmdbDurumYaz(metin) {
  $("#tmdbDurum").textContent = metin || (D.tmdb ? "Anahtar kayıtlı. Film araması ve katalog kapakları açık." : "Anahtar yok: yalnız dizi kapakları geliyor.");
}
$("#menuDugme").addEventListener("click", () => ayarlarAc());
$("#yedekPencere").addEventListener("click", (e) => { if (e.target === $("#yedekPencere") || e.target.closest("[data-kapat]")) $("#yedekPencere").close(); });
$("#tmdbKaydet").addEventListener("click", async () => {
  const deger = $("#tmdbAnahtar").value.trim();
  if (!deger) { D.tmdb = ""; kaydet(); tmdbDurumYaz(); kaynakNotu(); tmdbYenile(); renderKesfet(); return; }
  tmdbDurumYaz("Anahtar deneniyor…");
  const eski = D.tmdb; D.tmdb = deger;
  try {
    await tmdbIstek("/configuration", {});
    kaydet(); tmdbDurumYaz("Anahtar çalışıyor ✓ Katalog kapakları getiriliyor…");
    const n = await katalogKapaklari();
    tmdbDurumYaz(`Anahtar çalışıyor ✓ ${n || 0} yeni kapak bulundu.`);
    tmdbYenile();
  } catch (hata) {
    D.tmdb = eski; kaydet();
    tmdbDurumYaz(hata.message || "Anahtar denenemedi.");
  }
});
$("#kapaklariYenile").addEventListener("click", async () => {
  tmdbDurumYaz("Kapaklar aranıyor…");
  const n = await katalogKapaklari({ zorla: true });
  tmdbDurumYaz(`${n || 0} yeni kapak bulundu.`);
});
$("#disaAktar").addEventListener("click", () => {
  const kopya = { ...D, tmdb: "" }; // anahtar yedeğe girmez
  const blob = new Blob([JSON.stringify({ uygulama: "seyirlik", surum: 1, tarih: new Date().toISOString(), veri: kopya }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `seyirlik-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  bildirim("Yedek indirildi");
});
$("#iceAktar").addEventListener("change", async (e) => {
  const dosya = e.target.files[0]; if (!dosya) return;
  try {
    const j = JSON.parse(await dosya.text());
    if (j.uygulama !== "seyirlik" || !j.veri) throw new Error();
    if (!confirm("Mevcut listenin yerine yedekteki konulsun mu?")) return;
    const tmdb = D.tmdb;
    D = Object.assign(BOS_DURUM(), j.veri, { tmdb });
    D.ozel = (D.ozel || []).map((o) => ({ ...o, afis: guvenliUrl(o.afis) }));
    kaydet(); temaUygula(); turSecDoldur(); $("#yedekPencere").close(); git("listem");
    bildirim("Yedek yüklendi");
  } catch { bildirim("Bu dosya bir Seyirlik yedeği değil"); }
  e.target.value = "";
});
$("#sifirla").addEventListener("click", () => {
  if (!confirm("Listen, puanların, eklediklerin ve rozetlerin silinecek. Emin misin?")) return;
  const { tema, tmdb, afisler, imdb, afisDenendi } = D;
  D = Object.assign(BOS_DURUM(), { tema, tmdb, afisler, imdb, afisDenendi });
  kaydet(); $("#yedekPencere").close(); turSecDoldur(); git("kesfet");
  bildirim("Her şey sıfırlandı");
});

// ═════════ Başlat ═════════
temaUygula();
turSecDoldur();
D.rozetler = D.rozetler.filter((id) => ROZETLER.some((r) => r.id === id));
if ((D.afisSurum === 2 || D.afisSurum === 3) && D.tmdb) { // 3: TMDB eşleşmesi düzeltildi, film kapakları yeniden aranır
  KATALOG.forEach((o) => { if (o.tip === "film") { delete D.afisler[o.id]; delete D.afisDenendi["tmdb:" + o.id]; } });
  D.afisSurum = 4; kaydet();
}
if (!(D.afisSurum >= 2)) { // eski arama bazı dizileri kaçırıyordu: bulunamayanları yeniden dene
  Object.keys(D.afisDenendi).forEach((a) => { if (!D.afisler[a.split(":")[1]]) delete D.afisDenendi[a]; });
  D.afisSurum = 4; kaydet();
}
git(location.hash.slice(1) || "kesfet");
makaraDoldur([...KATALOG].sort(() => Math.random() - 0.5).slice(0, 12));
setTimeout(() => katalogKapaklari(), 600);
tmdbYenile();
