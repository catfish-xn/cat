import { expect } from 'vitest';
import type { Room } from '../src/server/room/room';
import { restoreCarouselSeat } from '../src/simulation/carousel';
import { canonicalContent } from '../src/simulation/content';

/** The second online restore boundary must authenticate the same owner facts as shared-pool restore. */
export function checkH8CarouselRestore(room:Room,seatId:string,edit:(value:any)=>void):void {
 const match=room.state.seats.find(s=>s.seatId===seatId)!.match;
 const carousel=room.state.carousel!.state,authority=room.augmentHistoryAuthority(seatId);
 for(const input of [match,JSON.stringify(match),canonicalContent(match)]){
  expect(restoreCarouselSeat(carousel,input,authority)).toEqual(match);
  expect(()=>restoreCarouselSeat(carousel,input)).toThrow('missing independent server authority');
 }
 for(const mutation of [edit,(value:any)=>{delete value.augmentHistory;}]){
  const bad=structuredClone(match);mutation(bad);
  for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restoreCarouselSeat(carousel,input,authority)).toThrow();
 }
}
