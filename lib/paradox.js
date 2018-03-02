let newLine = String.fromCharCode("13");

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

var zoneToHASSLabel = {};

module.exports = class ParadoxConnector {

	constructor ( configuration ) {

		if (!configuration)
			throw ("Configuration Required...");

		this._config = configuration;
		this._buffer = "";
	}

	Connect() {
		let mqtt = require("mqtt");
		this._mqttClient = mqtt.connect('mqtt://localhost');
		this._mqttClient.on("connect", () => {
			this._mqttClient.subscribe("paradox_evo");
		});

		let SerialPort = require("serialport");
                this._port = new SerialPort('/dev/' + this._config.device,
                {
                        baudRate: this._config.baudRate,
                });

		var connectPromise = new Promise( (resolve, reject) => {
			this._port.on('open', () => {
				console.log("Serial Port: " + this._config.device + " opened.");

				this._port.on('readable', (data) => {
                        	        var text = this._port.read();
			       		this._buffer+=text;
                                	var parts = this._buffer.split(newLine);
                                	for (var index = 0; index < parts.length-1; index++) {
						this.TranslateCommand(parts[index]);
                                	}

                                	this._buffer = parts[parts.length-1];
                        	});

				resolve();
	                });
		});

		// Get the labels, initial status, and panel status
		// panel status will be useful once we start controlling the alarm status
		var init = connectPromise
			.then( () => { return this.GetZoneLabels(); })
			.then( () => { return this.GetUserLabels(); })
			.then( () => { return this.GetAreaLabels(); })
			.then( () => { return this.GetInitialZoneStatus(); })
			.then( () => { return this.GetPanelStatus(); }) 

		return init;
	}

	GetGenericStatus(id, count) {
		// Note that this function is only responsible for sending commands
                // not processing them
                return new Promise( (resolve, reject) => {
                        var index = 0;
                        var int = setInterval(() => {
                                this.SendCommand(id + pad(++index, 3));
                                if (index === count) {
                                        clearInterval(int);
                                        resolve();
                                }
                        }, 50);
                });
	}

	GetGenericZoneStatus(id) {
		// Note that this function is only responsible for sending commands
                // not processing them
                return new Promise( (resolve, reject) => {
                        var zoneKeys = Object.keys(this._config.zoneConfiguration);
                        var count = zoneKeys.length;
                        var index = 0;
                        var int = setInterval(() => {
                                var zoneKey = zoneKeys[index++];
                                this.SendCommand(id + pad(zoneKey, 3));
                                if (index === count) {
                                        clearInterval(int);
                                        resolve();
                                }
                        }, 50);
                });

	}

	GetZoneLabels() {

		return this.GetGenericZoneStatus("ZL");
	}

	GetUserLabels() {

                return this.GetGenericStatus("UL", this._config.userCount);

        }

	GetAreaLabels() {
		return this.GetGenericStatus("AL", this._config.areaCount);
	}

	GetInitialZoneStatus() {
		return this.GetGenericZoneStatus("RZ");
	}

	GetPanelStatus() {
		return  new Promise( (resolve, reject) => {
			this.SendCommand("RA001");
			resolve();
		});
	}

	TranslateCommand(command) {

		if (command.indexOf("G") === 0) {
			this.ProcessSystemEvent(command);
		}
		else if (command.indexOf("ZL") === 0) {
			var label = command.substring(5, command.length).trim();
			var nospc = label.replaceAll(" ","_").toLowerCase();
			var zone = +command.substring(2, 5);
			var zoneConfiguration = this._config.zoneConfiguration;

			if (zoneConfiguration[zone]) {
				if (!zoneConfiguration[zone].name) {
					zoneConfiguration[zone] =  Object.assign(zoneConfiguration[zone], { name: label });
				}
				zoneToHASSLabel[zone] = nospc;
				var payload = JSON.stringify(zoneConfiguration[zone]);
				console.log ("Registering Zone: " + nospc + " with HA with payload: " + payload);
				this._mqttClient.publish("homeassistant/binary_sensor/" + nospc + "/config", payload);
			}
		}
		else if (command.indexOf("RZ") === 0) {
			//RZ010COOOO
			var zone = +command.substring(2, 5);
			var nospc = zoneToHASSLabel[zone];
			var status = command.substring(5, 6);
			var zoneConfiguration = this._config.zoneConfiguration;
			console.log("Sending default status for: " + nospc + ", Status: " + status);
			switch(status) {
				case "O":
					this._mqttClient.publish("homeassistant/binary_sensor/" + nospc + "/state", "ON");
					break;
				case "C":
					this._mqttClient.publish("homeassistant/binary_sensor/" + nospc + "/state", "OFF");
					break;
			}
		}
		else {
			console.log("Unknown message from panel: " + command);
		}
	}

	ProcessSystemEvent(event) {
		//G000N004A001
		var eventGroup = +(event.substring(1, 4));
		var eventNumber = +(event.substring(5, 8));
		var area = +(event.substring(9, 12));

		switch(eventGroup) {
			case 0: // Zone is OK
				var nospc = zoneToHASSLabel[eventNumber];
				this._mqttClient.publish("homeassistant/binary_sensor/" + nospc + "/state", "OFF");
				break;
			case 1: // Zone is Open
				var nospc = zoneToHASSLabel[eventNumber];
                                this._mqttClient.publish("homeassistant/binary_sensor/" + nospc + "/state", "ON");
				break;

		}

		console.log ("System eg: " + eventGroup + ", EV:" + eventNumber + ", Area:" + area);
	}

	SendCommand(command) {
		this._port.write(command + newLine);
	}

}

//module.exports.ParadoxConnector = ParadoxConnector
