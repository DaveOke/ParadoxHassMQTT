# ParadoxHassMQTT

HomeAssistant Support for Paradox Alarms using the Paradox Home Automation Integration Module (PRT3)

# Installation

Note: You'll need Node.JS for this project to run. See: https://nodejs.org. You'll also need a MQTT broker. I use Mosquitto, however, the built-in mqtt broker in Home Assistant should work fine.

1. Once downloaded, install this plugin using: npm install --unsafe-perm 
2. Update your configuration file. See bellow for a sample
3. You do not need to update the name in the zone configuration - if left blank, it will autopopulate from the panel
3. Note: This app must be run as a user with dial-out permissions or it won't be able to open the serial port
4. Add mqtt section to your configuration.yaml. Use autodiscovery option
5. Once this app is run, you should now see your paradox modules as sensors in HomeAssistant

Optional: You can use forever/forever-service to install this as a system service.

# Configuration

Configuration sample:

 ```
    var configuration = {
        mqttAddress: "mqtt://localhost",
        baudRate: 57600,
        device: 'ttyUSB0',
        areaCount: 1,
        userCount: 3,
	panelUserCode: "1111",
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
        },
        pgmConfiguration: {
                1: { "name": "TestPGM1", "device_class": "problem" } // Delete this line if no Virtual PGMs
        },
        virtualZoneConfiguration: {
                1 : { "panelZone": 12 } // delete this line if no virtual zones
        }

    }
 ```

# HomeAssistant Configuration

Configuration.yaml

 ```
	# Sample MQTT Alarm Panel for Area 1
	alarm_control_panel:
    - platform: mqtt
      state_topic: "paradox_evo/alarm/area/1"
      command_topic: "paradox_evo/alarm/area/1/set"
      name: "Paradox Evo"
      payload_disarm: "DISARM"
      payload_arm_home: "ARM"

    # Sample MQTT Virtual Zone
    switch:
      - platform: mqtt
        name: "Test Virtual Switch"
        state_topic: "paradox_evo/alarm/virtual_zone/1"
        command_topic: "paradox_evo/alarm/virtual_zone/1/set"
        payload_on: "OPEN"
        payload_off: "CLOSED"
```

Groups.yaml

```

	paradox_overview:
	  name: Paradox Alarm
	  entities:
		- alarm_control_panel.paradox_evo
		- binary_sensor.motion_sensor_1
		- binary_sensor.door_contact_1

```

# Virtual PGMs

Virtual PGMs entity name will be binary_sensor.paradox_vpgm<PGM ID>
