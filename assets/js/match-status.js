function matchState(item,now=Date.now()) {
 if(item.statusMode==='upcoming')return 'Upcoming';
 if(item.statusMode==='live')return 'LIVE';
 if(['ended','postponed','cancelled'].includes(item.statusMode))return {ended:'Ended',postponed:'Postponed',cancelled:'Cancelled'}[item.statusMode];
 const start=Date.parse(item.startAt||'');
 if(!Number.isFinite(start))return 'Time TBC';
 const explicitEnd=Date.parse(item.endAt||'');
 const end=Number.isFinite(explicitEnd)?explicitEnd:start+3*60*60*1000;
 return now<start?'Upcoming':now<end?'LIVE':'Ended';
}

