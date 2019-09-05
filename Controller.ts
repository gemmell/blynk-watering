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

 async function sleepUnlessCancelled(ms: number, cancelCheckFn: () => boolean) {
     if (cancelCheckFn() === false) {
         let total = 0;
         while ((total < ms) && (cancelCheckFn() === false)) {
             const sleepTime = Math.min(500, ms - total);
             await sleep(sleepTime);
             total += sleepTime;
         }
     }
 }

export class Controller {
    zones: Zone[];
    mains: Zone;
    scheduleTimer: later.Timer;
    cancelled: boolean;
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
        this.cancelled = false;
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

    async doPulse(zone: number, timeInMinutesOn: number, timeInMinutesOff?: number)
    {
        const checkForCancelled = () => this.zones[zone].cancelled;

        if (checkForCancelled() == false) {
            console.log("Starting " + this.zones[zone].name + " for " + timeInMinutesOn + " minutes");
            this.blynk.notify("Starting " + this.zones[zone].name + " for " + timeInMinutesOn + " minutes");
            this.mains.start();
            await sleepUnlessCancelled(500, checkForCancelled);
        }
        if (checkForCancelled() === false) {
            this.zones[zone].start();
            sleepUnlessCancelled(timeInMinutesOn * 60 * 1000, checkForCancelled);
        }
        if (checkForCancelled() === false) {
            this.zones[zone].stop();
            await sleepUnlessCancelled(500, checkForCancelled);
            this.turnOffMainsIfLastZone();
        }
        if (checkForCancelled() === false) {
            if (timeInMinutesOff) {
                console.log(this.zones[zone].name + " stopped for pulse off time of " + timeInMinutesOff + " minutes");
                this.blynk.notify(this.zones[zone].name + " stopped for pulse off time of " + timeInMinutesOff + " minutes");
                await sleepUnlessCancelled(timeInMinutesOff * 60 * 1000, checkForCancelled);
            }
        }
    }

    start(zone: number, timeInMinutes: number) {
        this.zones[zone].cancelled = false;
        (async () => {
            if (this.zones[zone].pulseWater && timeInMinutes > 30) {
                const aTenth = Math.floor(timeInMinutes / 10);
                // On for a tenth, off for a tenth (total now: 2)
                await this.doPulse(zone, aTenth, aTenth);
                // On for 2 tenths, off for a tenth (total now: 5)
                await this.doPulse(zone, 2*aTenth, aTenth);
                // On for 5 tenths (total now: 10)
                await this.doPulse(zone, 5*aTenth);
            } else {
                await this.doPulse(zone, timeInMinutes);
            }
        })();
    }

    stop(zone: number) {
        (async () => {
            this.zones[zone].cancelled = true;
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