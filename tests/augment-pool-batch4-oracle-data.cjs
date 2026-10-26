// Independent transcription of augments-14.24.json (2026-10-23 research), not runtime content.
// BardPlaybook1: UnitTier=2; LategameSpecialist: LevelReq=9, Gold=33;
// BardPlaybook2: levels 5/6/7/8; BirthdayPresents text: level minus 4, minimum 1, two stars;
// BardPlaybook3: levels 4/6/7, component/completed/radiant anvils. Timing follows P-B4.
module.exports={
 'caretakers-ally':{initialCost:2,repeatCopy:true},
 'lategame-specialist':{gold:[9,33]},
 'caretakers-favor':{anvils:[[5,'Component'],[6,'Component'],[7,'Component'],[8,'Component']]},
 'birthday-presents':{offset:4,min:1,star:2},
 'caretakers-chosen':{anvils:[[4,'Component'],[6,'Completed'],[7,'Radiant']]},
};
