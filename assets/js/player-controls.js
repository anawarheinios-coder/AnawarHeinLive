/* Fullscreen, genuine source/HLS quality selection, and supported TV casting. */
const AnawarPlayer = (() => {
 let castReady=false,castLoading=false;
 function note(message){const el=document.querySelector('.stream-message');if(el)el.textContent=message}
 function mediaType(src){return /\.m3u8(?:[?#]|$)/i.test(src)?'application/x-mpegURL':/\.webm(?:[?#]|$)/i.test(src)?'video/webm':'video/mp4'}
 function absolute(src){return new URL(src,location.href).href}
 function castContext(){return castReady?window.cast.framework.CastContext.getInstance():null}
 function updateCastButtons(){const session=castContext()?.getCurrentSession();document.querySelectorAll('[data-cast-tv]').forEach(button=>{button.textContent=session?'Stop casting':'Cast to TV';button.setAttribute('aria-pressed',String(!!session))})}
 function loadCast(){
  if(!window.isSecureContext||!/Chrome|Chromium|Edg/.test(navigator.userAgent)||/iPhone|iPad/.test(navigator.userAgent))return;
  if(castLoading||castReady)return;castLoading=true;
  window.__onGCastApiAvailable=available=>{castLoading=false;if(!available)return;try{const context=window.cast.framework.CastContext.getInstance();context.setOptions({receiverApplicationId:window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,autoJoinPolicy:window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED});castReady=true;context.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,updateCastButtons);updateCastButtons()}catch{castReady=false}};
  const script=document.createElement('script');script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';script.async=true;script.onerror=()=>{castLoading=false};document.head.append(script);
 }
 async function castVideo(video,source,title){
  if(!video){note('Use the embedded player’s own casting controls.');return}
  try{
   const context=castContext();
   if(context){const previous=context.getCurrentSession();if(previous){previous.endSession(true);updateCastButtons();note('Casting stopped.');return}await context.requestSession();const session=context.getCurrentSession();if(!session)return;const info=new window.chrome.cast.media.MediaInfo(absolute(source.url),mediaType(source.url));info.metadata=new window.chrome.cast.media.GenericMediaMetadata();info.metadata.title=title;const buffered=Number.isFinite(video.duration)&&video.duration>0;info.streamType=buffered?window.chrome.cast.media.StreamType.BUFFERED:window.chrome.cast.media.StreamType.LIVE;const request=new window.chrome.cast.media.LoadRequest(info);request.autoplay=true;if(buffered)request.currentTime=video.currentTime||0;await session.loadMedia(request);video.pause();note('Playing on your TV. The TV must be able to open this stream URL.');updateCastButtons();return}
   if(typeof video.webkitShowPlaybackTargetPicker==='function'){video.webkitShowPlaybackTargetPicker();return}
   if(video.remote&&typeof video.remote.prompt==='function'){await video.remote.prompt();return}
   note(castLoading?'TV casting is loading. Please try again in a moment.':'Casting is unavailable in this browser. Try Chrome with Chromecast or Safari with AirPlay on the same Wi-Fi.');
  }catch(error){if(['NotAllowedError','AbortError'].includes(error?.name)||String(error?.code).includes('cancel')){note('Casting selection was cancelled.');return}note('Unable to cast. Check that your TV is on the same Wi-Fi and can open this stream URL.')}
 }
 async function fullscreen(modal,video){try{if(document.fullscreenElement||document.webkitFullscreenElement){if(document.exitFullscreen)await document.exitFullscreen();else document.webkitExitFullscreen?.();return}if(modal.requestFullscreen)await modal.requestFullscreen();else if(modal.webkitRequestFullscreen)modal.webkitRequestFullscreen();else if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();else note('Fullscreen is unavailable in this browser.')}catch{note('Fullscreen was blocked. Use the video’s own fullscreen button or allow fullscreen in your browser.')}}
 function miniSupported(video){return !!video&&((document.pictureInPictureEnabled&&typeof video.requestPictureInPicture==='function')||(typeof video.webkitSupportsPresentationMode==='function'&&video.webkitSupportsPresentationMode('picture-in-picture')))}
 async function miniPlayer(video,toggle=true){if(!video)return;try{if(document.pictureInPictureElement===video){if(toggle)await document.exitPictureInPicture();return}if(video.webkitPresentationMode==='picture-in-picture'){if(toggle)video.webkitSetPresentationMode('inline');return}if(video.readyState<1){note('Wait for the video to load before opening the mini player.');return}if(document.fullscreenElement)await document.exitFullscreen();if(document.pictureInPictureEnabled&&video.requestPictureInPicture)await video.requestPictureInPicture();else if(video.webkitSetPresentationMode)video.webkitSetPresentationMode('picture-in-picture');else note('Mini Player is not supported in this browser.')}catch{note('Mini Player was blocked. Start playback and press Mini Player again, or allow Picture-in-Picture in your browser.')}}
 function closeMini(video){if(!video)return;if(document.pictureInPictureElement===video)document.exitPictureInPicture?.().catch(()=>{});if(video.webkitPresentationMode==='picture-in-picture')video.webkitSetPresentationMode?.('inline');video.pause()}
 function playbackState(video){return video?{time:Number.isFinite(video.duration)?video.currentTime:0,paused:video.paused,volume:video.volume,muted:video.muted}:null}
 function restore(video,state){if(!video||!state)return;video.volume=state.volume;video.muted=state.muted;const apply=()=>{if(Number.isFinite(video.duration)&&state.time>0)video.currentTime=Math.min(state.time,Math.max(0,video.duration-.1));if(state.paused)video.pause();else video.play().catch(()=>{})};if(video.readyState>=1)apply();else video.addEventListener('loadedmetadata',apply,{once:true})}
 function mount({modal,player,video,hls,streams,serverIndex,source,title,onSourceChange}){
  const old=document.getElementById('player-tools');if(old)old.remove();
  const tools=document.createElement('div');tools.id='player-tools';tools.className='player-tools';
  tools.innerHTML='<label class="quality-control">Resolution<select id="player-resolution" aria-label="Video resolution"></select></label><label class="fit-control">View<select id="player-fit" aria-label="Video fit"><option value="contain">Fit screen</option><option value="cover">Fill screen</option></select></label><button type="button" class="player-tool" data-cast-tv>Cast to TV</button><button type="button" class="player-tool" id="player-mini">Mini Player</button><label class="auto-pip-control" id="auto-pip-label" hidden><input type="checkbox" id="player-auto-pip">Auto mini player</label><button type="button" class="player-tool" id="player-fullscreen" aria-label="Toggle fullscreen">Fullscreen</button>';
  document.querySelector('.below-player').prepend(tools);
  const quality=tools.querySelector('#player-resolution'),fit=tools.querySelector('#player-fit'),castButton=tools.querySelector('[data-cast-tv]'),full=tools.querySelector('#player-fullscreen'),mini=tools.querySelector('#player-mini'),auto=tools.querySelector('#player-auto-pip');
  function option(value,label){const el=document.createElement('option');el.value=value;el.textContent=label;return el}
  function refreshQuality(){
   const selected=quality.value;quality.replaceChildren();
   if(!video){quality.append(option('provider','Use provider controls'));quality.disabled=true;return}
   quality.disabled=false;
   if(hls?.levels?.length>1){const group=document.createElement('optgroup');group.label='Stream resolutions';group.append(option('hls:-1','Auto (adaptive)'));hls.levels.forEach((level,index)=>group.append(option('hls:'+index,level.height?level.height+'p':Math.round((level.bitrate||0)/1000)+' kbps')));quality.append(group)}
   if(streams.length>1){const group=document.createElement('optgroup');group.label='Available quality / server links';streams.forEach((stream,index)=>{const height=index===serverIndex&&video.videoHeight?` · ${video.videoHeight}p`:'';group.append(option('source:'+index,(stream.label||'Server '+(index+1))+height))});quality.append(group)}
   if(!quality.options.length){quality.append(option('fixed',video.videoHeight?video.videoHeight+'p (source quality)':'Source quality'));quality.disabled=true}
   const preferred=hls?.levels?.length>1?'hls:'+(hls.autoLevelEnabled?-1:hls.currentLevel):'source:'+serverIndex;
   quality.value=[...quality.options].some(o=>o.value===selected)?selected:preferred;
  }
  quality.onchange=()=>{if(quality.value.startsWith('hls:')){hls.currentLevel=Number(quality.value.slice(4));note(quality.value==='hls:-1'?'Adaptive quality enabled.':'Resolution changed to '+quality.selectedOptions[0].textContent+'.')}else if(quality.value.startsWith('source:')){const index=Number(quality.value.slice(7));if(index!==serverIndex)onSourceChange(index,playbackState(video))}};
  fit.onchange=()=>{if(video)video.style.objectFit=fit.value};fit.disabled=!video;
  castButton.disabled=!video;castButton.title=video?'Choose Chromecast, AirPlay or a supported remote playback device.':'Use the embedded provider’s own casting controls.';castButton.onclick=()=>castVideo(video,source,title);
  const pipAvailable=miniSupported(video);mini.disabled=!pipAvailable;mini.title=video?'Keep watching in a floating window while switching tabs or apps.':'Use the embedded provider’s own mini player.';mini.onclick=()=>miniPlayer(video);
  const syncMini=()=>{const enabled=document.pictureInPictureElement===video||video?.webkitPresentationMode==='picture-in-picture';mini.textContent=enabled?'Return to page':'Mini Player';mini.setAttribute('aria-pressed',String(enabled))};
  let mediaActions=false;const session=navigator.mediaSession;
  auto.checked=localStorage.getItem('anawar-auto-pip')!=='off';
  function configureAuto(){if(!session||!pipAvailable)return;try{session.setActionHandler('enterpictureinpicture',auto.checked?()=>miniPlayer(video,false):null);tools.querySelector('#auto-pip-label').hidden=false;session.setActionHandler('play',()=>video.play().catch(()=>{}));session.setActionHandler('pause',()=>video.pause());if(window.MediaMetadata)session.metadata=new MediaMetadata({title,artist:'Anawar Live',album:'Live Sports'});mediaActions=true}catch{tools.querySelector('#auto-pip-label').hidden=true}}
  auto.title='Automatic mini player depends on browser support and your site permission. Chrome must stay open.';auto.onchange=()=>{localStorage.setItem('anawar-auto-pip',auto.checked?'on':'off');configureAuto()};configureAuto();
  const syncPlayback=()=>{if(session)try{session.playbackState=video.paused?'paused':'playing'}catch{}};
  if(video){video.addEventListener('enterpictureinpicture',syncMini);video.addEventListener('leavepictureinpicture',syncMini);video.addEventListener('webkitpresentationmodechanged',syncMini);video.addEventListener('play',syncPlayback);video.addEventListener('pause',syncPlayback)}syncMini();
  const syncFull=()=>{const expanded=!!(document.fullscreenElement||document.webkitFullscreenElement);full.textContent=expanded?'Exit fullscreen':'Fullscreen';full.setAttribute('aria-pressed',String(expanded))};full.onclick=()=>fullscreen(modal,video);
  document.addEventListener('fullscreenchange',syncFull);document.addEventListener('webkitfullscreenchange',syncFull);
  if(video){video.addEventListener('loadedmetadata',refreshQuality);video.addEventListener('resize',refreshQuality)}
  if(hls){hls.on(window.Hls.Events.MANIFEST_PARSED,refreshQuality);hls.on(window.Hls.Events.LEVEL_SWITCHED,refreshQuality)}
  refreshQuality();syncFull();updateCastButtons();
  return ()=>{if(mediaActions)for(const action of ['enterpictureinpicture','play','pause'])try{session.setActionHandler(action,null)}catch{}if(video){video.removeEventListener('enterpictureinpicture',syncMini);video.removeEventListener('leavepictureinpicture',syncMini);video.removeEventListener('webkitpresentationmodechanged',syncMini);video.removeEventListener('play',syncPlayback);video.removeEventListener('pause',syncPlayback)}document.removeEventListener('fullscreenchange',syncFull);document.removeEventListener('webkitfullscreenchange',syncFull);if(video){video.removeEventListener('loadedmetadata',refreshQuality);video.removeEventListener('resize',refreshQuality)}if(hls){hls.off(window.Hls.Events.MANIFEST_PARSED,refreshQuality);hls.off(window.Hls.Events.LEVEL_SWITCHED,refreshQuality)}};
 }
 loadCast();return {mount,restore,mediaType,playbackState,closeMini,miniSupported};
})();
