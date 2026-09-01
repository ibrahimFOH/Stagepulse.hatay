/* Stagepulse FCM registration v18: native Android bridge + optional Web FCM. */
(() => {
  const cfg=window.STAGEPULSE_FCM_CONFIG;
  const __rt=(typeof globalThis!=='undefined'?globalThis:window).STAGEPULSE_RUNTIME||{};
  const SUPABASE_URL=__rt.supabaseUrl||'';
  const SUPABASE_KEY=__rt.supabasePublishableKey||'';
  if(!SUPABASE_URL||!SUPABASE_KEY){console.error('[Stagepulse FCM] STAGEPULSE_RUNTIME missing');return;}
  const state={status:'idle',channel:'fcm',error:null,notification:'unknown',secureContext:false,serviceWorker:false,pushManager:false,subscription:false,token:false};
  const emit=()=>window.dispatchEvent(new CustomEvent('stagepulse:push-status',{detail:{...state}}));
  const setState=p=>{Object.assign(state,p);emit();};
  const isNativeAndroid=()=>!!window.StagepulseAndroid;
  const diagnostics=async()=>{
    if(isNativeAndroid()){
      const notification=window.StagepulseAndroid?.notificationPermissionGranted?.()===true?'granted':'unknown';
      setState({status:'ready',channel:'fcm',error:null,notification,secureContext:true,serviceWorker:true,pushManager:true,subscription:true,token:true});
      return {...state};
    }
    state.notification='Notification'in window?Notification.permission:'missing';
    state.secureContext=!!window.isSecureContext;
    state.serviceWorker='serviceWorker'in navigator;
    state.pushManager='PushManager'in window;
    emit();
    return {...state};
  };
  if(!cfg||!window.supabase){setState({status:'error',error:!cfg?'Firebase yapılandırması yüklenmedi.':'Supabase istemcisi yüklenmedi.'});return;}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let busy=false;
  let attemptedUser='';
  const variant=()=>cfg.appVariant==='admin'||document.documentElement.dataset.appVariant==='admin'||location.pathname.startsWith('/admin/')?'admin':'staff';

  async function syncNativeSession(sessionOverride=null){
    if(!isNativeAndroid()||!window.StagepulseAndroid?.setAccessToken)return null;
    try{
      let session=sessionOverride;
      if(!session){
        const {data,error}=await client.auth.getSession();
        if(error)throw error;
        session=data?.session||null;
      }
      const token=session?.access_token||'';
      window.StagepulseAndroid.setAccessToken(token);
      attemptedUser=session?.user?.id||'';
      return session;
    }catch(e){
      console.error('[Stagepulse FCM] Native session sync failed',e);
      return null;
    }
  }

  async function register(force=false){
    if(busy)return false;
    if(!force && (state.status==='error'||state.status==='unsupported'))return false;
    if(isNativeAndroid()){
      await syncNativeSession();
      if(window.StagepulseAndroid?.requestNotificationPermission) window.StagepulseAndroid.requestNotificationPermission();
      setState({status:'ready',channel:'fcm',error:null,secureContext:true,serviceWorker:true,pushManager:true,subscription:true,token:true,notification:'granted'});
      return true;
    }
    busy=true;setState({status:'checking',error:null});await diagnostics();
    try{
      if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){
        setState({status:'unsupported',channel:'web',error:null,subscription:false,token:false});
        return false;
      }
      if(location.protocol!=='https:'&&location.hostname!=='localhost')throw new Error('FCM Web için HTTPS gerekiyor.');
      const {data:{session},error:se}=await client.auth.getSession();if(se)throw se;
      if(!session?.user){setState({status:'idle',error:null});return false;}
      if(Notification.permission==='denied'){
        setState({status:'permission',error:'Bildirim izni cihaz ayarlarından engellenmiş.'});
        return false;
      }
      if(Notification.permission!=='granted'){
        setState({status:'permission',error:null});
        return false;
      }
      if(!cfg.apiKey||!cfg.projectId||!cfg.appId||!cfg.messagingSenderId||!cfg.vapidKey)throw new Error('Firebase FCM yapılandırması eksik.');
      if(!window.firebase||!firebase.messaging)throw new Error('Firebase Messaging SDK yüklenmedi.');
      if(!firebase.apps.length)firebase.initializeApp(cfg);
      const supported=typeof firebase.messaging.isSupported==='function'?await firebase.messaging.isSupported():true;
      if(!supported){setState({status:'unsupported',channel:'web',error:null,subscription:false,token:false});return false;}
      // Reuse the site's root service worker. Registering a second worker with
      // the same scope replaces the PWA worker and makes background delivery
      // depend on which page was visited last.
      const sw=await navigator.serviceWorker.register('/sw.js?v=20260901-fcm-unified',{scope:'/',updateViaCache:'none'});
      await navigator.serviceWorker.ready;try{await sw.update();}catch(_){ }
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:cfg.vapidKey,serviceWorkerRegistration:sw});
      if(!token)throw new Error('FCM registration token alınamadı.');
      const {error}=await client.rpc('register_notification_device',{p_token:token,p_platform:'web',p_app_variant:variant()});if(error)throw error;
      attemptedUser=session.user.id;
      setState({status:'ready',channel:'fcm',subscription:true,token:true,error:null});
      window.dispatchEvent(new CustomEvent('stagepulse:fcm-ready',{detail:{appVariant:variant(),channel:'fcm'}}));
      messaging.onMessage(payload=>window.dispatchEvent(new CustomEvent('stagepulse:fcm-message',{detail:payload})));
      return true;
    }catch(e){
      const detail=[e?.name,e?.code,e?.message].filter(Boolean).join(' | ')||String(e);
      setState({status:'error',error:detail,subscription:false,token:false});
      console.error('[Stagepulse FCM]',e);
      return false;
    }finally{busy=false;}
  }

  async function enable(){
    if(isNativeAndroid()){
      if(window.StagepulseAndroid?.requestNotificationPermission) window.StagepulseAndroid.requestNotificationPermission();
      await syncNativeSession();
      return register(true);
    }
    try{
      if(!('Notification'in window))throw new Error('Notification API desteklenmiyor.');
      const p=await Notification.requestPermission();
      if(p!=='granted'){setState({status:'permission',error:`Bildirim izni verilmedi: ${p}`});return false;}
      return register(true);
    }catch(e){
      const detail=e?.message||String(e);setState({status:'error',error:detail});return false;
    }
  }

  window.StagepulseFCM={register,enable,diagnostics,getStatus:()=>({...state})};
  const initFcm=()=>register(false).catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFcm,{once:true});else void initFcm();
  client.auth.onAuthStateChange((event,session)=>{
    if(isNativeAndroid()){
      syncNativeSession(session);
      if(window.StagepulseAndroid?.refreshSession) window.StagepulseAndroid.refreshSession();
    }
    if(!session?.user){attemptedUser='';return;}
    if(event==='SIGNED_IN' || (event==='INITIAL_SESSION' && attemptedUser!==session.user.id))setTimeout(()=>register(false).catch(()=>{}),0);
  });
})();
