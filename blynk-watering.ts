import {Controller, WateringSchedule} from "./Controller"

import * as BlynkLib from 'blynk-library'
const AUTH = process.env.BLYNK_WATERING_KEY;
const blynk = new BlynkLib.Blynk(AUTH, {port: 443});

const goButton = new blynk.VirtualPin(10);
const timeInMinutesSlider = new blynk.VirtualPin(11);
const zoneSelector = new blynk.VirtualPin(1);
const scheduleWidget = new blynk.VirtualPin(5);

const controller: Controller = new Controller(blynk);

let currentZoneIdx = 0; 
let customTimeInMinutes = 40;

zoneSelector.on('write', function (param) {
  currentZoneIdx = Number(param) - 1;
  console.log("Set to zone: " + controller.zones[currentZoneIdx].name);
  // Sync our schedule with the UI
  scheduleWidget.write(controller.zones[currentZoneIdx].wateringSchedule);
});

goButton.on('write', function (param) {
   if ((param[0] == 1) && (controller.zones[currentZoneIdx].isOn === false)) {
      controller.start(currentZoneIdx, customTimeInMinutes);
   } else if (controller.zones[currentZoneIdx].isOn === true) {
      controller.stop(currentZoneIdx);
   }
});

timeInMinutesSlider.on('write', function (param) {
   customTimeInMinutes = Number(param[0]);
   console.log("Set time in minutes to:" + customTimeInMinutes);
});

scheduleWidget.on('write', function (params) {
   const schd: WateringSchedule = Number(params[0]);
   controller.setSchedule(currentZoneIdx, schd);
});

blynk.on('connect', function() {
   blynk.syncAll(); 
   console.log("Blynk ready."); 
});

blynk.on('disconnect', function() { console.log("DISCONNECT"); });
