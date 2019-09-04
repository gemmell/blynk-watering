import {Controller, WateringSchedule} from "./Controller"

import * as BlynkLib from 'blynk-library'
const AUTH = process.env.BLYNK_WATERING_KEY;
const blynk = BlynkLib.Blynk(AUTH);

const goButton = new blynk.VirtualPin(10);
const timeInMinutesSlider = new blynk.VirtualPin(11);
const zoneSelector = new blynk.VirtualPin(1);
const scheduleWidget = new blynk.VirtualPin(6);

const controller: Controller = new Controller(blynk);

let currentZone = 1; 
let customTimeInMinutes = 40;

zoneSelector.on('write', function (param) {
  console.log(param[0]);
  currentZone = Number(param);
  console.log("Set to zone: " + controller.zones[currentZone].name);
});

goButton.on('write', function (param) {
   if ((param[0] == 1) && (controller.zones[currentZone].isOn === false)) {
      controller.start(currentZone, customTimeInMinutes);
   } else if (controller.zones[currentZone].isOn === true) {
      controller.stop(currentZone);
   }
});

timeInMinutesSlider.on('write', function (param) {
   customTimeInMinutes = Number(param[0]);
   console.log("Set time in minutes to:" + customTimeInMinutes);
});

scheduleWidget.on('write', function (param) {
   const schd: WateringSchedule = param;
   controller.setSchedule(currentZone, schd);
});

blynk.on('connect', function() {
   blynk.syncAll(); 
   console.log("Blynk ready."); 
});

blynk.on('disconnect', function() { console.log("DISCONNECT"); });
