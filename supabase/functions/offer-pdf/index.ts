import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const cors={"Access-Control-Allow-Origin":"https://stagepulse.com.tr","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const money=(v:unknown)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(num(v));
const wrap=(text:string,font:any,size:number,max:number)=>{const words=String(text||"").split(/\s+/).filter(Boolean);const lines:string[]=[];let line="";for(const word of words){const test=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(test,size)<=max)line=test;else{if(line)lines.push(line);line=word;}}if(line)lines.push(line);return lines;};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return json({error:"Method Not Allowed"},405);
  try{
    const h=req.headers.get("authorization")||"";if(!h.toLowerCase().startsWith("bearer "))return json({error:"Oturum gerekli."},401);
    const url=Deno.env.get("SUPABASE_URL")!,sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,ak=Deno.env.get("SUPABASE_ANON_KEY")!;
    const uc=createClient(url,ak,{global:{headers:{Authorization:h}},auth:{persistSession:false}});
    const {data:ud,error:ue}=await uc.auth.getUser(h.slice(7).trim());if(ue||!ud.user)return json({error:"Oturum gerekli."},401);
    const {data:m,error:me}=await uc.from("org_memberships").select("user_id,active,role:role_id(code,is_admin_role)").eq("user_id",ud.user.id).eq("active",true).maybeSingle();if(me||!m)return json({error:"Yönetici oturumu gerekli."},403);
    const role=Array.isArray((m as any).role)?(m as any).role[0]:(m as any).role;
    const {data:g,error:ge}=await uc.from("admin_capability_grants").select("capability_key").eq("user_id",ud.user.id).eq("enabled",true);if(ge)return json({error:"Yetki kontrolü başarısız."},403);
    const caps=new Set((g||[]).map((x:any)=>x.capability_key).filter(Boolean));if(role?.code!=="owner"&&!caps.has("offers.pdf")&&!caps.has("offers.pdf.generate"))return json({error:"Teklif PDF yetkisi gerekli."},403);

    const b=await req.json().catch(()=>({})),oid=String(b?.offer_id||"");if(!oid)return json({error:"offer_id gerekli."},400);
    const db=createClient(url,sk,{auth:{persistSession:false}});
    const {data:o,error:oe}=await db.from("teklifler").select("*").eq("id",oid).single();if(oe||!o)return json({error:"Teklif bulunamadı."},404);
    const {data:rawItems}=await db.from("offer_items").select("description,quantity,unit_price,total,notes,equipment_id").eq("offer_id",oid).order("created_at");
    const {data:rawAttachments}=await db.from("offer_attachments").select("storage_path,file_name,mime_type,customer_visible,sort_order,kind,title,include_in_pdf").eq("offer_id",oid).eq("customer_visible",true).eq("include_in_pdf",true).order("sort_order").order("created_at");
    const items=Array.isArray(rawItems)?rawItems:[],attachments=Array.isArray(rawAttachments)?rawAttachments:[];
    const itemSubtotal=items.reduce((sum:number,item:any)=>sum+num(item.total??num(item.quantity)*num(item.unit_price)),0);
    const crewCount=Math.max(0,Math.floor(num(o.crew_count))),crewUnitPrice=Math.max(0,num(o.crew_unit_price)),crewTotal=crewCount*crewUnitPrice,discount=Math.max(0,num(o.discount)),grandTotal=Math.max(0,itemSubtotal+crewTotal-discount);
    const rawLayout=o.pdf_layout&&typeof o.pdf_layout==='object'?o.pdf_layout:{};
    const sections=Array.isArray(rawLayout.sections)?rawLayout.sections:["brand","customer","scope","items","totals","attachments","footer"];
    const layout={title:String(rawLayout.title||"Teklif"),subtitle:String(rawLayout.subtitle||"Profesyonel Ses & Sahne Teknolojileri · Hatay"),show_validity:rawLayout.show_validity!==false,show_customer:rawLayout.show_customer!==false,show_scope:rawLayout.show_scope!==false,show_items:rawLayout.show_items!==false,show_totals:rawLayout.show_totals!==false,show_attachments:rawLayout.show_attachments!==false,show_footer:rawLayout.show_footer!==false,custom_note:String(rawLayout.custom_note||""),attachment_heading:String(rawLayout.attachment_heading||"Sahne / Sistem Görseli")};

    const [fontBytes,boldBytes]=await Promise.all([
      fetch("https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error("FONT_FETCH_FAILED");return r.arrayBuffer()}),
      fetch("https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error("FONT_FETCH_FAILED");return r.arrayBuffer()})
    ]);
    const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const regular=await pdf.embedFont(fontBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true});
    const W=595.28,H=841.89,margin=48,width=W-margin*2;let page=pdf.addPage([W,H]),y=H-52;
    const newPage=()=>{page=pdf.addPage([W,H]);y=H-52};const ensure=(need:number)=>{if(y<need)newPage()};
    const text=(s:string,size=10,f=regular)=>{ensure(size+14);page.drawText(String(s??""),{x:margin,y,size,font:f,color:rgb(.08,.08,.08)});y-=size+7};
    const lines=(s:string,size=10,f=regular,max=width)=>{for(const line of wrap(String(s||""),f,size,max))text(line,size,f)};
    const section=(s:string)=>{ensure(45);page.drawText(s,{x:margin,y,size:13,font:bold,color:rgb(.08,.08,.08)});y-=22};
    const block=(rows:string[])=>{const h=rows.length*18+18;ensure(h+16);page.drawRectangle({x:margin,y:y-h+10,width,height:h,borderWidth:1,borderColor:rgb(.82,.82,.82),color:rgb(.98,.98,.98)});y-=2;for(const row of rows)text(row,10,regular);y-=10};
    const drawBrand=()=>{ensure(60);page.drawText("STAGEPULSE",{x:margin,y,size:24,font:bold,color:rgb(.95,.58,.02)});y-=31;lines(layout.subtitle,9);text(`${layout.title}: ${o.quote_number||""}`,12,bold);if(layout.show_validity&&o.valid_until)text(`Geçerlilik: ${o.valid_until}`,9);y-=4};
    const drawCustomer=()=>{section("Müşteri");block([`Müşteri: ${o.name||""}`,`Firma: ${o.company||""}`,`Telefon: ${o.phone||""}`,`E-posta: ${o.email||""}`])};
    const drawScope=()=>{section("Yapılacak iş / kapsam");const serviceList=Array.isArray(o.services)?o.services.map((x:any)=>typeof x==='string'?x:String(x?.name||x?.label||'')).filter(Boolean):[];const service=serviceList.join(", ")||o.type||o.event_type||"Hizmet";block([`Hizmet: ${service}`,`Etkinlik türü: ${o.event_type||o.type||""}`,`Lokasyon: ${o.location||""}`,o.event_date?`Tarih: ${o.event_date}`:"",num(o.people)>0?`Tahmini seyirci: ${num(o.people)} (bilgi)`:""].filter(Boolean));if(o.message){text("Talep / yapılacak iş",10,bold);lines(String(o.message),9);y-=4}if(layout.custom_note){text("Ek not",10,bold);lines(layout.custom_note,9)}};
    const drawItems=()=>{section("Ekipman & malzeme listesi");ensure(38);page.drawText("#",{x:margin,y,size:9,font:bold});page.drawText("Malzeme / ekipman",{x:margin+22,y,size:9,font:bold});page.drawText("Adet",{x:margin+340,y,size:9,font:bold});page.drawText("Birim",{x:margin+385,y,size:9,font:bold});page.drawText("Toplam",{x:margin+445,y,size:9,font:bold});y-=17;if(!items.length){text("Bu hizmet için kayıtlı malzeme yok. Fiyatlandırma → Hizmet malzeme varsayılanları ile ekleyin.",9);return}items.forEach((item:any,i:number)=>{const desc=[item.description,item.notes?`Not: ${item.notes}`:""] .filter(Boolean).join(" "),ls=wrap(desc,regular,9,310),h=Math.max(18,ls.length*12+10);ensure(h+18);page.drawText(String(i+1),{x:margin,y,size:9,font:regular});ls.forEach((line,j)=>page.drawText(line,{x:margin+22,y:y-j*12,size:9,font:regular}));page.drawText(String(num(item.quantity)),{x:margin+340,y,size:9,font:regular});page.drawText(money(item.unit_price),{x:margin+385,y,size:9,font:regular});page.drawText(money(item.total),{x:margin+445,y,size:9,font:regular});y-=Math.max(18,ls.length*12+6);page.drawLine({start:{x:margin,y},end:{x:margin+width,y},thickness:.5,color:rgb(.85,.85,.85)});y-=8})};
    const drawTotals=()=>{section("Ücret");if(crewCount>0){text("Personel",10,bold);page.drawText(String(crewCount),{x:margin+340,y,size:10,font:regular});page.drawText(money(crewUnitPrice),{x:margin+385,y,size:10,font:regular});page.drawText(money(crewTotal),{x:margin+445,y,size:10,font:regular});y-=24}if(discount>0){text(`İndirim: -${money(discount)}`,10);y-=3}ensure(45);page.drawText(`TOPLAM ${money(grandTotal)}`,{x:margin,y,size:17,font:bold,color:rgb(.95,.58,.02)});y-=27;text("KDV ve ek nakliye şartlara göre ayrıca belirtilebilir. Bu belge bilgilendirme amaçlı tekliftir.",8)};
    const drawAttachments=async()=>{section(layout.attachment_heading);if(!attachments.length){text("Bu teklif için eklenmiş SPL 3D / Stage Plot / sistem görseli bulunmuyor.",9);return}for(const a of attachments){try{const signed=await db.storage.from("offer-assets").createSignedUrl(a.storage_path,600);if(signed.error||!signed.data?.signedUrl)continue;const r=await fetch(signed.data.signedUrl,{signal:AbortSignal.timeout(15000)});if(!r.ok)continue;const buf=await r.arrayBuffer();if(a.mime_type==='application/pdf'){const source=await PDFDocument.load(buf),indices=source.getPageIndices();const copied=await pdf.copyPages(source,indices);newPage();text(`Ek doküman: ${a.title||a.file_name||"PDF"}`,10,bold);for(const cp of copied)pdf.addPage(cp);newPage();}else if(a.mime_type==='image/png'||a.mime_type==='image/jpeg'){const img=a.mime_type==='image/png'?await pdf.embedPng(buf):await pdf.embedJpg(buf);const maxW=width,maxH=560,scale=Math.min(maxW/img.width,maxH/img.height,1),iw=img.width*scale,ih=img.height*scale;ensure(ih+40);page.drawImage(img,{x:margin+(width-iw)/2,y:y-ih,width:iw,height:ih});y-=ih+10;text(String(a.title||a.file_name||"Görsel"),8);y-=10}}catch(_){}}};
    const drawFooter=()=>{ensure(38);text(`Stagepulse · stagepulse.com.tr · Teklif tarihi: ${new Date().toISOString().slice(0,10)}`,8);if(o.public_token)lines(`Online onay: https://stagepulse.com.tr/teklif-view.html?token=${o.public_token}`,8)};
    for(const key of sections){if(key==='brand')drawBrand();else if(key==='customer'&&layout.show_customer)drawCustomer();else if(key==='scope'&&layout.show_scope)drawScope();else if(key==='items'&&layout.show_items)drawItems();else if(key==='totals'&&layout.show_totals)drawTotals();else if(key==='attachments'&&layout.show_attachments)await drawAttachments();else if(key==='footer'&&layout.show_footer)drawFooter()}
    if(!sections.includes('brand'))drawBrand();if(layout.show_footer&&!sections.includes('footer'))drawFooter();

    const bytes=await pdf.save();const bytesBuffer=new Uint8Array(bytes).buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;const path=`offers/${oid}/stagepulse-${o.quote_number||oid}-${Date.now()}.pdf`;
    const up=await db.storage.from("offer-pdfs").upload(path,new Blob([bytesBuffer],{type:"application/pdf"}),{contentType:"application/pdf",upsert:false});if(up.error)return json({error:"PDF kaydedilemedi."},500);
    const dg=await crypto.subtle.digest("SHA-256",bytesBuffer),sha256=Array.from(new Uint8Array(dg)).map(x=>x.toString(16).padStart(2,"0")).join("");
    const {data:latest}=await db.from("offer_pdf_assets").select("version_no").eq("offer_id",oid).order("version_no",{ascending:false}).limit(1);const v=(latest?.[0]?.version_no||0)+1;await db.from("offer_pdf_assets").update({is_current:false,updated_at:new Date().toISOString()}).eq("offer_id",oid);
    const fileName=`stagepulse-${o.quote_number||oid}.pdf`;const ins=await db.from("offer_pdf_assets").insert({offer_id:oid,storage_path:path,file_name:fileName,mime_type:"application/pdf",size_bytes:bytes.byteLength,sha256,version_no:v,is_current:true,customer_visible:true,created_by:ud.user.id});if(ins.error)return json({error:"PDF kaydı oluşturulamadı."},500);
    return json({ok:true,path,file_name:fileName,version_no:v,total:grandTotal,crew_total:crewTotal,item_subtotal:itemSubtotal});
  }catch(e){console.error(e);return json({error:"İşlem başarısız."},500)}
});
