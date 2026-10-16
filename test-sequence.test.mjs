import test from 'node:test';import assert from 'node:assert/strict';
import {TRACK,SEQUENCE_INFO,sampleSequence,sampleObservedTelemetry} from './test-sequence.js';
test('all four replays stay finite and clamp at the endpoint',()=>{
 for(const mode of ['full','inversion','flight','kickflip']){for(let t=0;t<=SEQUENCE_INFO[mode].duration;t+=.025){const s=sampleSequence(t,mode);for(const v of [...s.position,s.pitch,s.roll,s.yaw,s.wheelTravel,s.plumePower])assert.ok(Number.isFinite(v),mode+' '+t);assert.ok(s.position[1]>-.02)}assert.equal(sampleSequence(1e6,mode).time,SEQUENCE_INFO[mode].duration)}
});
test('the first run holds inverted and returns without leaving the track',()=>{
 for(const t of [20,24,25]){const s=sampleSequence(t,'inversion');assert.equal(s.contact,true);assert.ok(Math.abs(s.pitch*180/Math.PI-170)<2)}
 const a=sampleSequence(24,'inversion'),b=sampleSequence(25,'inversion');assert.ok(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))<.01);assert.ok(sampleSequence(40,'inversion').position[1]<.02);
});
test('both different-radius wheel axles meet the shared curved track',()=>{
 for(let t=0;t<=45;t+=.2){const s=sampleSequence(t,'inversion');for(const c of s.contacts){const front=c.axle==='front',axle=front?TRACK.axleFront:TRACK.axleRear,r=front?TRACK.frontTireRadius:TRACK.rearTireRadius;const x=s.position[0]+axle*Math.cos(s.pitch)+r*Math.sin(s.pitch),y=s.position[1]-axle*Math.sin(s.pitch)+r*Math.cos(s.pitch);assert.ok(Math.hypot(x-c.position[0]-r*c.normal[0],y-c.position[1]-r*c.normal[1])<1e-7)}}
});
test('release continues pitch to upright without yaw and lands backwards',()=>{
 const air=sampleSequence(53,'full');assert.equal(air.contact,false);assert.ok(air.pitch>Math.PI);const a=sampleSequence(55,'full'),b=sampleSequence(56,'full');assert.ok(b.position[0]>a.position[0]);assert.equal(a.yaw,0);assert.ok(Math.abs(a.pitch-Math.PI*2)<.01);assert.equal(sampleSequence(58,'full').contact,true);
});
test('kickflip rolls one turn over the obstacle and resumes grounded travel',()=>{
 assert.equal(sampleSequence(12,'kickflip').contact,true);const s=sampleSequence(14,'kickflip');assert.equal(s.contact,false);assert.ok(s.position[1]>9);assert.ok(s.roll>Math.PI/2);assert.equal(s.pitch,0);const end=sampleSequence(18,'kickflip');assert.equal(end.contact,true);assert.ok(Math.abs(end.roll-Math.PI*2)<1e-8);assert.ok(sampleSequence(20,'kickflip').position[0]<end.position[0]);
});
test('screen telemetry is interpolated only between displayed readings',()=>{
 assert.equal(sampleObservedTelemetry(680).downforceKg,4689);assert.equal(sampleObservedTelemetry(682.5).downforceKg,4694.5);assert.equal(sampleObservedTelemetry(700).downforceKg,null);assert.equal(sampleObservedTelemetry(713).pitchDeg,null);assert.equal(sampleObservedTelemetry(715).altitudeFt,21.4);
});
