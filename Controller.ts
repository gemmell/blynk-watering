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
    blynk: any;
    terminal: any;

    private log(text: string) {
        this.terminal.write(text);
        console.log(text);
    }

    constructor(blynk: any, terminal: any) {
        this.blynk = blynk;
        this.terminal = terminal;
        this.mains = new Zone(blynk, "mains", 27);
        if (fs.existsSync('zones.json')) {
            let jsonZones = fs.readFileSync('zones.json');
            for (let i = 0; i < jsonZones.length; i++) {
               this.zones.push(Zone.fromJson(jsonZones[i]));
            }
        } else {
            this.zones = [
                new Zone(blynk, "veggies", 3, true, WateringSchedule.everySecondDay, 60),
                new Zone(blynk, "side", 4, true, WateringSchedule.weekly, 60),
                new Zone(blynk, "grass", 17, false, WateringSchedule.everyThirdDay, 60),
                new Zone(blynk, "elm", 2, true, WateringSchedule.everyThirdDay, 60)
            ];
        }
    }
 
    turnOffMainsIfLastZone() {
        if (this.mains.isOn === true) {
            this.log("Mains is on");
            let allOff = true;
            for (let i = 0; i < this.zones.length; i++) {
                if (this.zones[i].isOn === true) {
                    this.log(this.zones[i].name + " is still on");
                    allOff = false;
                }
            }
            if (allOff === true) {
                this.log("Turning mains off");
                this.mains.stop();
            }
        }
    }

    async doPulse(zone: number, timeInMinutesOn: number, timeInMinutesOff?: number)
    {
        const checkForCancelled = () => { return this.zones[zone].cancelled; }

        if (checkForCancelled() == false) {
            this.log("Starting " + this.zones[zone].name + " for " + timeInMinutesOn + " minutes");
            this.blynk.notify("Starting " + this.zones[zone].name + " for " + timeInMinutesOn + " minutes");
            this.mains.start();
            await sleepUnlessCancelled(500, checkForCancelled);
        }
        if (checkForCancelled() === false) {
            this.zones[zone].start();
            await sleepUnlessCancelled(timeInMinutesOn * 60 * 1000, checkForCancelled);
        }
        if (checkForCancelled() === false) {
            this.zones[zone].stop();
            await sleepUnlessCancelled(500, checkForCancelled);
            this.turnOffMainsIfLastZone();
        }
        if (checkForCancelled() === false) {
            if (timeInMinutesOff) {
                this.log(this.zones[zone].name + " stopped for pulse off time of " + timeInMinutesOff + " minutes");
                this.blynk.notify(this.zones[zone].name + " stopped for pulse off time of " + timeInMinutesOff + " minutes");
                await sleepUnlessCancelled(timeInMinutesOff * 60 * 1000, checkForCancelled);
            }
        }
    }

    start(zone: number, timeInMinutes: number) {
        (async () => {
            this.log("Starting " + this.zones[zone].name + " @ " + new Date());
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
            // Finished, make sure we set up the next schedule
            this.setSchedule(zone, this.zones[zone].wateringSchedule);
        })();
    }

    stop(zone: number) {
        (async () => {
            this.zones[zone].cancelled = true;
            this.zones[zone].stop();
            await sleep(1000);
            this.turnOffMainsIfLastZone();
            this.log("Stopped " + this.zones[zone].name + ".");
            this.blynk.notify("Stopped " + this.zones[zone].name + ".");
            this.setSchedule(zone, this.zones[zone].wateringSchedule);
            // Because of all the stuff above, mostly the sleep 1000, we're just about assured
            // that it won't have been cancelled. There's all sorts of rentrant issues here, but meh.
            this.zones[zone].cancelled = false;
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
            const s = later.parse.text(scheduleString);
            let startFn = () => {
                this.start(zone, this.zones[zone].preferredDurationInMins);
            };
            let occurrences = later.schedule(s).next(1);
            const preferredDuration = this.zones[zone].preferredDurationInMins;
            this.zones[zone].nextOccurenceText = this.zones[zone].name + " next scheduled on " + occurrences + " for " + preferredDuration + " minutes";
            this.log(this.zones[zone].nextOccurenceText);
            this.zones[zone].nextOccurence = later.setInterval(startFn, s);
        } else {
            this.zones[zone].nextOccurenceText = this.zones[zone].name + " does not have a recurring schedule.";
        }
    }
}