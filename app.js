var ParadoxConnector = require('./lib/paradox');

// Adjust the device class to match your sensors. Remove/Add as needed
// zone configuration key should match the zone id on your panel
// If the name field is left blank, the zone name is automatically pulled from the Paradox panel.
// If you specify a name, your name will override the panel's zone name

var configuration = {
    mqttAddress: "mqtt://localhost",
    baudRate: 57600,
    device: "ttyUSB0",
    areaCount: 1,
    userCount: 3, // NOT CURRENTLY USED (just reads user names from the panel)
    panelUserCode: "1234",
    zoneConfiguration: {
        1: {"name": "", "device_class": "motion"},
        2: {"name": "", "device_class": "motion"},
        3: {"name": "", "device_class": "door"},
        4: {"name": "", "device_class": "motion"},
        5: {"name": "", "device_class": "motion"},
        6: {"name": "", "device_class": "door"},
        7: {"name": "", "device_class": "door"},
        8: {"name": "", "device_class": "problem"},
        9: {"name": "", "device_class": "window"},
        10: {"name": "", "device_class": "window"},
        11: {"name": "", "device_class": "window"},
        12: {"name": "", "device_class": "problem"}
    },
    pgmConfiguration: {
        1: {"name": "TestPGM1", "device_class": "problem"} // Delete this line if no Virtual PGMs
    },
    virtualZoneConfiguration: {
        1: {"panelZone": 12} // delete this line if no virtual zones
    }
}

// Start the paradox bridge
var connector = new ParadoxConnector(configuration);

connector.Connect();

