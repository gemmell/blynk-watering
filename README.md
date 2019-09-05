# Blynk-Watering
My RPi based watering system written for the blnyk system (blynk.cc) in typescript.

I have 4 zones, and a setup that involves a Blynk selector for the Zone, a selection of 5 different watering plans (every day, every second day, every third day, weekly and none), LEDs to indicate when the mains and a zone is on, a slider for a manual time input and a go button to turn on the zone manually. 

I run it like this:

> BLYNK_WATERING_KEY=thekey TZ="Australia/Sydney" pm2 start blynk-watering.ts

# License
Haiku license.
This code is simple
Use it however you like
I hope it helps you
