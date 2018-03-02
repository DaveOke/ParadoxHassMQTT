# ParadoxHassMQTT

Support for Paradox Alarms using the Paradox Home Integration Module (PRT3)

# Installation

1. Once downloaded, install this plugin using: npm install --unsafe-perm 
2. Update your configuration file. See bellow for a sample.
3. Note: This app must be run as a user with dial-out permissions or it won't be able to open the serial port
4. Add mqtt section to your configuration.yaml. Use autodiscovery option.
5. Once this app is run, you should now see your paradox modules as sensors in HomeAssistant

# Configuration

Configuration sample:

 ```
    var configuration = {
        baudRate: 57600,
        device: 'ttyUSB0',
        areaCount: 1,
        userCount: 3,
        zoneConfiguration:  {
                1: { "name": "", "device_class": "motion"},
                2: { "name": "", "device_class": "motion"},
                3: { "name": "", "device_class": "door"},
                4: { "name": "", "device_class": "motion"},
                5: { "name": "", "device_class": "motion"},
                6: { "name": "", "device_class": "door"},
                7: { "name": "", "device_class": "door"},
                8: { "name": "", "device_class": "problem"},
                9: { "name": "", "device_class": "window"},
                10: { "name": "", "device_class": "window"},
                11: { "name": "", "device_class": "window"},
        }
    }

