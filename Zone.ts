import {Gpio} from 'onoff';
import * as BlynkLib from 'blynk-library'
import {WateringSchedule} from './Controller'

export class Zone {
    id: number;
    name: string;
    ledPin: any;
    gpio: Gpio;
    isOn: boolean;
    wateringSchedule: WateringSchedule;
    pulseWater: boolean;
    nextOccurenceText: string;
    nextOccurence: later.Timer;
    blynk: any;
    cancelled: boolean = false; // Whether something has cancelled a watering session
    preferredDurationInMins: number = 60;
    constructor(blynk: any, name: string, pin: number, pulseWater?: boolean, wateringSchedule?: WateringSchedule, preferredDurationInMins?: number)
    {
       this.blynk = blynk;
       this.name = name;
       this.ledPin = new blynk.VirtualPin(pin);
       this.gpio = new Gpio(pin, 'out');
       this.gpio.writeSync(1);
       this.isOn = false;
       this.pulseWater = pulseWater;
       this.wateringSchedule = wateringSchedule;
       this.ledPin.write(0); //Turn off the led.
       if (preferredDurationInMins) {
         this.preferredDurationInMins = preferredDurationInMins;
       }
    }
 
    get toJson() {
       return {
          name: this.name,
          pin: this.ledPin.pin,
          pulseWater: this.pulseWater,
          wateringSchedule: this.wateringSchedule
       };
    }
 
    static fromJson(json) {
       return new Zone(json.name, json.pin, json.pulseWater, json.wateringSchedule);
    }
 
    start() {
       this.ledPin.write(255); //turn on the blynk led
       this.isOn = true;      
       this.gpio.writeSync(0);
    }
 
    stop() {
       this.gpio.writeSync(1);
       //Turn off the blynk leds
       this.ledPin.write(0);
       this.isOn = false;
    }
 }