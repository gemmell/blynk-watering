import {Gpio} from 'onoff';
import * as BlynkLib from 'blynk-library'


export class Zone {
    id: number;
    name: string;
    pin: number;
    gpio: Gpio;
    isOn: boolean;
    scheduleText: string;
    pulseWater: boolean;
    nextOccurence: later.Timer;
    blynk: any;

    constructor(blynk: any, name: string, pin: number, pulseWater?: boolean, scheduleText?: string)
    {
       this.blynk = blynk;
       this.name = name;
       this.pin = pin;
       this.gpio = new Gpio(pin, 'out');
       this.gpio.writeSync(1);
       this.isOn = false;
       this.pulseWater = pulseWater;
       this.scheduleText = scheduleText;
       this.blynk.virtualWrite(this.pin, 0); //Turn off the led.
    }
 
    get toJson() {
       return {
          name: this.name,
          pin: this.pin,
          pulseWater: this.pulseWater,
          scheduleText: this.scheduleText
       };
    }
 
    static fromJson(json) {
       return new Zone(json.name, json.pin, json.pulseWater, json.scheduleText);
    }
 
    start() {
       this.blynk.virtualWrite(this.pin, 255); //turn on the blnyk led
       this.isOn = true;      
       this.gpio.writeSync(0);
    }
 
    stop() {
       this.gpio.writeSync(1);
       //Turn off the blynk leds
       this.blynk.virtualWrite(this.pin, 0); 
       this.isOn = false;
    }
 }