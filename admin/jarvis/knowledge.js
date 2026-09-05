/** Stagepulse Admin Jarvis — local knowledge (no API keys) */
window.SP_ADMIN_KB = {
  brand: "Stagepulse",
  role: "Admin / saha operasyon asistanı",
  owner: "İbrahim Kavasoğlu",
  phone: "+90 532 068 3012",
  wa: "https://wa.me/905320683012",
  email: "teklifal@stagepulse.com.tr",
  site: "https://stagepulse.com.tr",
  regions: ["Hatay", "Antalya", "Adana", "Gaziantep", "Şanlıurfa", "Mersin"],
  services: ["Ses sistemi kiralama", "FOH / canlı miks", "Stage Plot & teknik rider", "SPL / sistem tasarımı", "3D sahne çizimi", "Sahne ışık", "Dante / network audio", "Kurulum & söküm"],
  quote_fields: ["ad soyad / firma", "telefon", "etkinlik türü", "tarih", "şehir / mekan", "kişi sayısı", "hizmetler", "not / rider"],
  event_checklist: ["Tarih ve mekan onayı", "Seyirci / misafir kapasitesi", "Açık / kapalı alan", "Elektrik / jeneratör notu", "Stage Plot veya rider var mı?", "FOH konumu", "Kurulum günü / saati", "Söküm planı", "Yedek kablo / DI / stand", "İletişim kişisi (organizatör)"],
  foh_checklist: ["Konsol tipi ve kanal ihtiyacı", "Gain yapısı / sahneden FOH yolu", "Monitor / IEM ihtiyacı", "Playback / click yolu", "RF koordinasyonu (varsa)", "Soundcheck süresi", "Show call saati", "Acil kontakt"],
  pack_templates: {
    dugun_kucuk: { title: "Küçük düğün / salon (≈100–250)", items: ["Point source veya küçük array", "2–4 sub (ihtiyaca göre)", "FOH konsol", "2–4 vokal wireless", "Basit sahne monitör", "Temel ışık seti (opsiyonel)"] },
    dugun_orta: { title: "Orta düğün / açık alan (≈250–500)", items: ["Line array veya güçlü point source", "Sub set", "FOH + monitor", "Wireless vokal / enstrüman", "Işık + truss (opsiyonel)", "Kurulum 1 gün"] },
    konser: { title: "Konser / festival bandı", items: ["Line array + sub", "FOH mühendis", "Stage monitor / IEM", "Stage Plot zorunlu", "Patch / stagebox", "Soundcheck bloğu", "Yedek güç planı"] },
    kurumsal: { title: "Kurumsal / lansman", items: ["Konuşma odaklı PA", "Kablosuz mikrofon", "Playback / laptop girişi", "Basit ışık / logo yıkama", "FOH veya operatör"] }
  },
  message_templates: {
    teklif_talep: "Merhaba {ad},\n\nStagepulse — teklif için şu bilgilere ihtiyacımız var:\n• Etkinlik türü\n• Tarih\n• Şehir / mekan\n• Tahmini kişi sayısı\n• İstenen hizmetler (ses / FOH / ışık)\n\nBu bilgileri iletirseniz teknik kapsamı netleştirip dönüş yaparız.\n\nİbrahim Kavasoğlu\nFOH Engineer · Stagepulse\n{telefon}",
    teyit: "Merhaba {ad},\n\n{tarih} · {sehir} · {tur} etkinliğiniz için notları aldık.\nKapsam: {hizmetler}\nKişi: {kisi}\n\nTeknik kontrol sonrası net teklifi ileteceğiz.\n\nStagepulse · {telefon}",
    kurulum: "Kurulum notu — {tarih} {mekan}\n• Varış / load-in: {saat}\n• Elektrik: {elektrik}\n• FOH konumu: {foh}\n• İletişim: {kisi}\n\nStagepulse saha ekibi"
  },
  sop: {
    yeni_teklif: ["1. Etkinlik bilgilerini topla (tür, tarih, şehir, kişi, hizmet).", "2. Açık/kapalı ve elektrik notunu sor.", "3. Rider/Stage Plot iste.", "4. Paket şablonundan kabaca kapsam seç.", "5. WhatsApp veya teklif formu ile müşteriye teyit gönder.", "6. Admin/panelde kaydet (online ise)."],
    show_gunu: ["1. Call time ve load-in doğrula.", "2. Güç / toprak kontrol.", "3. Patch ve line check.", "4. Soundcheck.", "5. Show.", "6. Söküm ve envanter sayımı."]
  },
  skills: [
    { id: "help", label: "Yardım / komutlar", sample: "yardım" },
    { id: "quote", label: "Teklif özeti", sample: "teklif özeti: Hatay düğün 400 kişi 20.09.2026 ses+FOH" },
    { id: "wa", label: "WhatsApp mesajı", sample: "whatsapp teklif talebi yaz" },
    { id: "check", label: "Etkinlik checklist", sample: "etkinlik checklist" },
    { id: "foh", label: "FOH checklist", sample: "foh checklist" },
    { id: "pack", label: "Paket önerisi", sample: "paket konser" },
    { id: "brief", label: "Saha brifingi", sample: "brifing: Adana konser yarın 19:00" },
    { id: "sop", label: "Süreç (SOP)", sample: "süreç yeni teklif" },
    { id: "regions", label: "Bölgeler", sample: "bölgeler" },
    { id: "notes", label: "Not kaydet", sample: "not: jeneratör müşteriden" }
  ]
};
