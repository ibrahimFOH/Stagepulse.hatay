/** Stagepulse Admin Jarvis Pro — local knowledge; no API keys. */
window.SP_ADMIN_KB = {
  version: '2.0-pro', brand: 'Stagepulse', role: 'Admin / saha / teklif operasyon asistanı', owner: 'İbrahim Kavasoğlu',
  phone: '+90 532 068 3012', wa: 'https://wa.me/905320683012', email: 'teklifal@stagepulse.com.tr', site: 'https://stagepulse.com.tr',
  regions: ['Hatay','Antalya','Adana','Gaziantep','Şanlıurfa','Mersin'],
  services: ['Ses kiralama','FOH / canlı miks','Stage Plot & rider','SPL / sistem','3D çizim','Işık','Dante','Kurulum & söküm'],
  event_checklist: ['Tarih ve mekan onayı','Kapasite','Açık / kapalı','Elektrik / jeneratör','Stage Plot veya rider','FOH konumu','Kurulum günü / saati','Söküm planı','Yedek kablo / DI / stand','Organizatör iletişim','Yağmur planı','Park / load-in yolu'],
  foh_checklist: ['Konsol tipi / kanal','Gain / sahneden FOH yolu','Monitor / IEM','Playback / click','RF koordinasyon','Soundcheck süresi','Show call','Acil kontakt','Yedek konsol / laptop'],
  light_checklist: ['Truss / stand ihtiyacı','Moving / wash / beam adedi (keşif sonrası)','DMX yolu','Güç dağıtımı','Timecode ihtiyacı','Operatör ihtiyacı'],
  pack_templates: {
    dugun_kucuk:{title:'Küçük düğün / salon (≈100–250)',items:['Point source veya küçük array','2–4 sub (ihtiyaca göre)','FOH konsol','2–4 vokal wireless','Basit monitör','Opsiyonel ışık']},
    dugun_orta:{title:'Orta düğün / açık alan (≈250–500)',items:['Line array veya güçlü PS','Sub set','FOH + monitor','Wireless vokal/enstrüman','Işık + truss opsiyon','Kurulum ~1 gün']},
    konser:{title:'Konser / festival',items:['Line array + sub','FOH mühendis','Monitor / IEM','Stage Plot zorunlu','Stagebox / patch','Soundcheck bloğu','Yedek güç']},
    festival:{title:'Festival / çok akt',items:['Ana PA + delay (gerekirse)','FOH + monitor ekibi','Changeover planı','RF koordinasyon','Çoklu stage plot']},
    kurumsal:{title:'Kurumsal / lansman',items:['Konuşma odaklı PA','Wireless mikrofon','Playback girişi','Logo / yıkama ışık','Operatör']}
  },
  message_templates: {
    teklif_talep:'Merhaba {ad},\n\nStagepulse teklifi için:\n• Etkinlik türü\n• Tarih\n• Şehir / mekan\n• Kişi sayısı\n• Hizmetler (ses / FOH / ışık)\n\nBilgileri iletin, teknik kapsamı netleştirip dönüş yapalım.\n\nİbrahim Kavasoğlu\nFOH · Stagepulse\n{telefon}',
    teyit:'Merhaba {ad},\n\n{tarih} · {sehir} · {tur}\nKapsam: {hizmetler}\nKişi: {kisi}\n\nTeknik kontrol sonrası net teklifi ileteceğiz.\n\nStagepulse · {telefon}',
    kurulum:'Kurulum — {tarih} {mekan}\n• Load-in: {saat}\n• Elektrik: {elektrik}\n• FOH: {foh}\n• İletişim: {kisi}\n\nStagepulse saha',
    takip:'Merhaba {ad},\n\n{tarih} tarihli talebiniz için ek bilgi veya rider paylaşabilir misiniz? Teklifi netleştirmek için yardımcı olur.\n\nStagepulse · {telefon}',
    red_nazik:'Merhaba {ad},\n\nMaalesef {tarih} için kapasitemiz / kapsam uygun görünmüyor. Alternatif tarih veya sadeleştirilmiş paket konuşabiliriz.\n\nStagepulse · {telefon}'
  },
  sop:{
    yeni_teklif:['1. Tür, tarih, şehir, kişi, hizmet topla','2. Açık/kapalı + elektrik','3. Rider / Stage Plot iste','4. Paket şablonu seç','5. WA teyit veya form','6. Panelde kaydet','7. Takip tarihi koy (48s)'],
    show_gunu:['1. Call time / load-in','2. Güç / toprak','3. Patch + line check','4. Soundcheck','5. Show','6. Söküm + sayım','7. Foto / not arşiv'],
    saha_acil:['1. Güvenlik — güç kes gerekirse','2. Yedek kablo / kanal','3. Operatör değişimi','4. Organizatöre kısa bilgilendirme','5. Olay notu yaz']
  },
  pricing_notes:['Fiyat bu araçta üretilmez.','Değişkenler: ekipman, süre, nakliye, kurulum günü, personel, açık alan riski.','Şehir dışı: ulaşım + konaklama ayrıca.'],
  skills:[
    {id:'help',label:'Yardım',sample:'yardım'},{id:'quote',label:'Teklif özeti',sample:'teklif: Hatay düğün 400 kişi 20.09.2026 ses+FOH açık alan'},
    {id:'wa',label:'WA taslağı',sample:'wa teyit'},{id:'check',label:'Etkinlik checklist',sample:'etkinlik checklist'},
    {id:'foh',label:'FOH checklist',sample:'foh checklist'},{id:'light',label:'Işık checklist',sample:'ışık checklist'},
    {id:'pack',label:'Paket',sample:'paket konser'},{id:'brief',label:'Saha brifing',sample:'brifing Adana konser 19:00'},
    {id:'sop',label:'SOP',sample:'süreç yeni teklif'},{id:'acil',label:'Saha acil',sample:'süreç saha acil'},
    {id:'follow',label:'Takip mesajı',sample:'wa takip'},{id:'notes',label:'Not',sample:'not: jeneratör müşteriden'},
    {id:'jobs',label:'İşler',sample:'işler'},{id:'day',label:'Gün planı',sample:'gün planı 20.09.2026 Hatay düğün'}
  ]
};
