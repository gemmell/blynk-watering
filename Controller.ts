import {Zone} from "./Zone"
import * as later from 'later';
later.date.localTime(); //tell later to use the local time.
import * as BlynkLib from 'blynk-library'


var fs = require('fs');

export enum WateringSchedule {
    daily = 1,
    everySecondDay,
    everyThirdDay,
    weekly,
    never
 };


 function sleep(ms) {
    return new Promise(resolve => {
       setTimeout(resolve, ms)
    })
 }

export class Controller {
    zones: Zone[];
    mains: Zone;
    scheduleTimer: later.Timer;
    blynk: any;
    constructor(blynk: any) {
        this.blynk = blynk;
        this.mains = new Zone(blynk, "mains", 27);
        if (fs.existsSync('zones.json')) {
            let jsonZones = fs.readFileSync('zones.json');
            for (let i = 0; i < jsonZones.length; i++) {
               this.zones.push(Zone.fromJson(jsonZones[i]));
            }
        } else {
            this.zones = [
                new Zone(blynk, "veggies", 3, true),
                new Zone(blynk, "side", 4, true),
                new Zone(blynk, "grass", 17, false),
                new Zone(blynk, "elm", 2, true)
            ];
        }
    }
 
    turnOffMainsIfLastZone() {
        if (this.mains.isOn === true) {
            console.log("Mains is on");
            let allOff = true;
            for (let i = 0; i < this.zones.length; i++) {
                if (this.zones[i].isOn === true) {
                    console.log(this.zones[i].name + " is still on");
                    allOff = false;
                }
            }
            if (allOff === true) {
                console.log("Turning mains off");
                this.mains.stop();
            }
        }
    }

    start(zone: number, timeInMinutes: number) {
        (async () => {
            this.mains.start();
            await sleep(1000);
            this.zones[zone].start();
            let timeInMilliSeconds = timeInMinutes * 60 * 1000;
            setTimeout(() => {
                this.stop(zone);
            }, timeInMilliSeconds);
            console.log("Started " + this.zones[zone].name + " for " + timeInMinutes + " minutes");
            this.blynk.notify("Started " + this.zones[zone].name + " for " + timeInMinutes + " minutes");
        })();
    }

    stop(zone: number) {
        (async () => {
            this.zones[zone].stop();
            await sleep(1000);
            this.turnOffMainsIfLastZone();
            console.log("Stopped " + this.zones[zone].name + ".");
            this.blynk.notify("Stopped " + this.zones[zone].name + ".");
            this.setSchedule(zone, this.zones[zone].wateringSchedule);
        })();
    }

    setSchedule(zone: number, desiredSchedule: WateringSchedule)
    {
        const thisZone = this.zones[zone];
        if (thisZone.wateringSchedule !== desiredSchedule) {
            thisZone.wateringSchedule = desiredSchedule;
            // Latest start is 7am, so based on the zone we want to offset them by an hour
            const startTime: number = 7 - zone;
            let scheduleString: string = "";
            switch (desiredSchedule) {
                case WateringSchedule.everySecondDay:
                    scheduleString = "at " + startTime + ":00 am every 2nd day"; break;
                case WateringSchedule.everyThirdDay:
                    scheduleString = "at " + startTime + ":00 am every 3rd day"; break;
                case WateringSchedule.daily:
                    scheduleString = "at " + startTime + ":00 am"; break;
                case WateringSchedule.weekly:
                    scheduleString = "at " + startTime + ":00 am on Mon"; break;
                default:
                    scheduleString = null;
            };
            this.setScheduleWithText(zone, scheduleString);
        }
    }

    setScheduleWithText(zone: number, scheduleString: string) {
        const thisZone = this.zones[zone];
        if (thisZone.nextOccurence) {
            thisZone.nextOccurence.clear();
        }
        if (scheduleString) {
            console.log("Using schedule text: " + scheduleString);
            const s = later.parse.text(scheduleString);
            let startFn = () => {
                this.start(60, zone);
            };
            let occurrences = later.schedule(s).next(1);
            console.log(this.zones[zone].name + " next scheduled on " + occurrences + " for 60 minutes");
            this.blynk.notify(this.zones[zone].name + " next scheduled on " + occurrences + " for 60 minutes");
            this.zones[zone].nextOccurence = later.setInterval(startFn, s);
        }
    }
}