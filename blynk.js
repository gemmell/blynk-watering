#!/usr/bin/env node
require('dotenv').load();
var Blynk = require('blynk-library');
var later = require('later');
var fs = require('fs');

var AUTH = process.env.BLYNK_WATERING_KEY;
console.log(AUTH);
var blynk = new Blynk.Blynk(AUTH);
var Gpio = require('onoff').Gpio;

var goButton = new blynk.VirtualPin(10);
var timeInMinutesSlider = new blynk.VirtualPin(11);
var zoneSelector = new blynk.VirtualPin(12);
var scheduleWidget = new blynk.VirtualPin(13);

class Zone {
   constructor(name, pin, scheduleText)
   {
      this.name = name;
      this.pin = pin;
      this.gpio = new Gpio(pin);
      this.state = "off";
      this.scheduleText = scheduleText || "";       
      blynk.virtualWrite(this.pin, 0); //Turn off the led.
   }

   get toJson() {
      return {
         name: this.name,
         pin: this.pin,
         scheduleText: this.scheduleText
      };
   }

   static fromJson(json) {
      return new Zone(json.name, json.pin, json.scheduleText);
   }

   get isOn() {
      return (this.state === "on");
   }

   setSchedule(scheduleText, timeInMinutes) {
      this.scheduleText = scheduleText;      
      this.schedule = later.parse.text(this.scheduleText);
      this.scheduleTimeInMinutes = timeInMinutes;
      let startFn = () => {
         this.start(timeInMinutes);
      };
      this.scheduleTimer = later.setInterval(startFn, this.schedule);
      let occurrences = later.schedule(this.schedule).next(1);
      blynk.notify(this.name + " next scheduled on " + occurrences[0] + " for " + this.scheduleTimeInMinutes + " minutes");

   }

   start(timeInMinutes) {
      blynk.virtualWrite(this.pin, 255); //turn on the led
      this.state = "on";
      this.gpio.writeSync(0);
      let timeInMilliSeconds = timeInMinutes * 60 * 1000;
      setTimeout(() => {
         this.stop();
      }, timeInMilliSeconds);
      console.log("Started " + this.name + " for " + timeInMinutes + " minutes");
      blynk.notify("Started " + this.name + " for " + timeInMinutes + " minutes");      
   }

   stop() {
      this.gpio.writeSync(1);
      console.log("Stopping " + this.name);
      blynk.virtualWrite(this.pin, 0); //Turn off the led
      this.state = "off";
      turnOffMainsIfLastZone();
      let occurrences = later.schedule(this.schedule).next(1);
      blynk.notify("Stopped " + this.name + ". Next scheduled on " + occurrences[0] + " for " + this.scheduleTimeInMinutes + " minutes");
   }
}

let mains = new Zone("mains", 27);
let zones = [
   new Zone("veggies", 3),
   new Zone("side",    4),
   new Zone("elm",     2),
   new Zone("misc",    17)
];

let currentZone = zones[0]; 
let customTimeInMinutes = 40;

function turnOffMainsIfLastZone() {
   if (mains.isOn === true) {
      for (let i = 0; i < zones.length; i++) {
         let allOff = true;
         if (zones[i].isOn === true) {
            allOff = false;
         }
         if (allOff === true) {
            mains.stop();
         }
      }
   }
}

zoneSelector.on('write', function (param) {
  console.log(param[0]);
  currentZone = zones[Number(param[0]) - 1];
  console.log("Set to zone: " + currentZone.name);
});

goButton.on('write', function (param) {
   if ((param[0] == 1) && (currentZone.isOn === false)) {
      currentZone.start(customTimeInMinutes);
   } else if (currentZone.isOn === true) {
      currentZone.stop();
   }
});

timeInMinutesSlider.on('write', function (param) {
   customTimeInMinutes = Number(param[0]);
   console.log("Set time in minutes to:" + customTimeInMinutes);
});

function blynkScheduleToLaterString(seconds, timezone, daysAsNumbers) {
   var d = new Date();
   d.setHours(0, 0, Number(seconds));
   let daysStr = " on " + daysAsNumbers.replace("1", " Mon").replace("2", " Tues").replace("3", " Wed").replace("4", " Thurs").replace("5", " Fri").replace("6", " Sat").replace("7", " Sun").trim();
   if (daysStr === " on Mon, Tues, Wed, Thurs, Fri, Sat, Sun") {
      daysStr = " everyday"; //It's every day, lets just omit it
   }

   let timeStr = (d.toLocaleTimeString("en-AU", { hour: '2-digit', minute: '2-digit', timeZone: timezone }));
   return 'at ' + timeStr + daysStr;
}

scheduleWidget.on('write', function (params) {
   console.log(params);
   
   let schString = blynkScheduleToLaterString(params[0], params[2], params[3]);
   
   let timeInMinutes = (params[1] - params[0]) / 60;
   if (params[0] > params[1]) {
      timeInMinutes = (params[0] - params[1]) / 60;
   }
   currentZone.setSchedule(schString, timeInMinutes);
});

blynk.on('connect', function() {
   blynk.syncAll(); 
   console.log("Blynk ready."); 
});
blynk.on('disconnect', function() { console.log("DISCONNECT"); });
