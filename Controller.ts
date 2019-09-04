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
                    allOff = false;
                }
            }
            if (allOff === true) {
                console.log("Turning mains off");
                this.mains.gpio.writeSync(1);
                this.blynk.virtualWrite(this.mains.pin, 0);
            }
        }
    }

    start(timeInMinutes: number, zone: number) {
        this.mains.start();
        this.zones[zone].start();
        let timeInMilliSeconds = timeInMinutes * 60 * 1000;
        setTimeout(() => {
           this.stop(zone);
        }, timeInMilliSeconds);
        console.log("Started " + this.zones[zone].name + " for " + timeInMinutes + " minutes");
        this.blynk.notify("Started " + this.zones[zone].name + " for " + timeInMinutes + " minutes");      
     }

     stop(zone: number) {
       this.turnOffMainsIfLastZone();
       this.blynk.notify("Stopped " + this.zones[zone].name + ".");
       this.setScheduleWithText(zone, this.zones[zone].scheduleText);
     }

    setSchedule(zone: number, desiredSchedule: WateringSchedule)
    {
        // Latest start is 7am, so based on the zone we want to offset them by an hour
        const startTime: number = 7 - zone;
        let scheduleString: string = "";
        switch (desiredSchedule) {
            case WateringSchedule.everySecondDay:
                scheduleString = "at " + startTime + "am every 2nd day of the year"; break;
            case WateringSchedule.everyThirdDay:
                scheduleString = "at " + startTime + "am every 3rd day of the year"; break;
            case WateringSchedule.daily:
                scheduleString = "at " + startTime + "am every day of the year"; break;
            case WateringSchedule.weekly:
                scheduleString = "at " + startTime + "am every Mon of the year"; break;
            default:
                if (this.zones[zone].nextOccurence) {
                    this.zones[zone].nextOccurence.clear();
                }
                console.log(this.zones[zone].name + " is never going to water...");
        };
        this.setScheduleWithText(zone, scheduleString);
    }

    setScheduleWithText(zone: number, scheduleString: string) {
        this.zones[zone].scheduleText = scheduleString;
        const s = later.parse.text(scheduleString);

        let startFn = () => {
            this.start(60, zone);
        };
        this.zones[zone].nextOccurence = later.setInterval(startFn, s);
        let occurrences = later.schedule(s).next(1);
        this.blynk.notify(this.zones[zone].name + " next scheduled on " + occurrences + " for 60 minutes");

    }
}