#!/usr/bin/env node

var Blynk = require('blynk-library');

var AUTH = process.env.BLYNK_WATERING_KEY;

var blynk = new Blynk.Blynk(AUTH);

var v0 = new blynk.VirtualPin(0);
var v1 = new blynk.VirtualPin(1);
var v2 = new blynk.VirtualPin(2);
var v3 = new blynk.VirtualPin(3);
var v4 = new blynk.VirtualPin(4);
var v9 = new blynk.VirtualPin(9);

let zones = [
   {name: "veggies", pin: 3, index: 1},
   {name: "misc", pin: 17, index: 4}, 
   {name: "elm", pin: 2, index: 3},
   {name: "side", pin: 17, index: 2},
   {name: "mains", pin: 27}
];

let currentZone = zones[0]; 
let timeInMinutes = 40;

v0.on('write', function(param) {
  console.log(param[0]);
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].index == param[0]) {
      currentZone = zones[i];
      console.log("Set to zone: " + currentZone.name);
    }
  }
});

v1.on('write', function(param) {
   console.log(param);
   let ledVal = (param[0] == 1) ? 255 : 0;
   blynk.virtualWrite(v2, ledVal); 
   
});

v3.on('write', function(param) {
   console.log(param);
   timeInMinutes = Number(param[0]);
   console.log("Set time in minutes to:" + timeInMinutes);
});

v9.on('read', function() {
  v9.write(new Date().getSeconds());
});

blynk.on('connect', function() {
   blynk.syncAll(); 
   console.log("Blynk ready."); 
});
blynk.on('disconnect', function() { console.log("DISCONNECT"); });
