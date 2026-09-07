(function(global){
 'use strict';
 const base='https://mtjcqqrogjqaxkagwkti.supabase.co';
 const key='sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
 const functions=base+'/functions/v1/';
 global.STAGEPULSE_JARVIS_CONFIG=Object.freeze({supabaseUrl:base,publishableKey:key,functions:{patronAI:functions+'patron-ai',tools:functions+'jarvis-tools',approve:functions+'jarvis-approve',audit:functions+'jarvis-audit'}});
})(typeof globalThis!=='undefined'?globalThis:window);