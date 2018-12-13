let newLine = String.fromCharCode("13");
let paradoxSerialTiming = 100;


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

		if (!this._config.mqttAddress)
			this._config.mqttAddress = "mqtt://localhost";

		var authParams;
		if (this._config.mqttUsername && this._config.mqttPassword) {
			authParams = { "username" : this._config.mqttUsername , "password": this._config.mqttPassword };
		}

		this._mqttClient = mqtt.connect(this._config.mqttAddress, authParams);
		this._mqttClient.on("connect", () => {
			console.log("MQTT Connected!");
			this._mqttClient.on('message', (topic, message) => {

			var cmd = message.toString();

			var topicParts = topic.split("/");
			switch (topicParts[2]) {
				case "area":
					var area = +topicParts[3];
					var paddedArea = pad(area, 3);

					console.log("Received alarm state change from HA: " + cmd);
                                	switch (cmd) {
                                       		case "ARM":
                                     	        	this.SendCommand("AA" + paddedArea + "S" + this._config.panelUserCode);
                                       	        	this._msg = "armed_home";
                                          	break;
                                          	case "ARM_AWAY":
                                                	this.SendCommand("AA" + paddedArea + "A" + this._config.panelUserCode);
                                                	this._msg = "armed_away";
                                          	break;
                                          	case "DISARM":
                                                	this.SendCommand("AD" + paddedArea + this._config.panelUserCode);
                                          	break;
                                  	}

				break;

				case "virtual_zone":
					var zone = +topicParts[3];
					var paddedZone = pad(zone, 3);

                                        if (cmd === "OPEN") {
                                              this.SendCommand("VO" + paddedZone);
                                        }
                                        else if (cmd === "CLOSED") {
                                                this.SendCommand("VC" + paddedZone);
                                        }

				break;
			}
			});

			for (var index = 1; index <= this._config.areaCount; index++) {
				this._mqttClient.subscribe("paradox_evo/alarm/area/" + index + "/set");
			}

		});

		return this.ConnectSerial();
	}

	ConnectSerial() {

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
                                                this.TranslateCommand(parts[index].trim());
                                        }

                                        this._buffer = parts[parts.length-1];
                                });

                                resolve();
                        });
                });

                // Get the labels, initial status, and panel status
                // panel status will be useful once we start controlling the alarm status
                var init = connectPromise
                        .then( () => { return this.RegisterVirtualZones(); })
                        .then( () => { return this.GetZoneLabels(); })
                        .then( () => { return this.GetUserLabels(); })
                        .then( () => { return this.GetAreaLabels(); })
                        .then( () => { return this.GetInitialZoneStatus(); })
                        .then( () => { return this.GetPanelStatus(); })
                        .then( () => { return this.RegisterVirtualPGMs(); })

                this._port.on('close', () => {
                        console.log("Port Closed... Will retry to open in 5 seconds");
			setTimeout( () => { this.ConnectSerial(); } , 5000 );
                });

		this._port.on('error', () => {
                        console.log("Error opening port. Retrying in 5 seconds.");
                        setTimeout( () => { this.ConnectSerial(); } , 5000 );
                });


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
                        }, paradoxSerialTiming);
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
                        }, paradoxSerialTiming);
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
			var index = 1;
			var int = setInterval( () => {
				var paddedArea = pad(index, 3);
				this.SendCommand("RA" + paddedArea);
				if (index++ === this._config.areaCount) {
					clearInterval(int);
					resolve();
				}
			}, paradoxSerialTiming);
		});
	}

	RegisterVirtualPGMs() {
		return new Promise( (resolve, reject) => {

			if (!this._config.pgmConfiguration)
				resolve();

			var keys = Object.keys(this._config.pgmConfiguration);
			keys.forEach( (key) => {
				var payload = JSON.stringify(this._config.pgmConfiguration[key]);
				console.log ("Registering Virtual PGM: paradox_vpgm" + key + " with HA with payload: " + payload);

				this.SendMQTTEvent("homeassistant/binary_sensor/paradox_vpgm" + key + "/config", payload);
			});

			resolve();
		});
	}

	RegisterVirtualZones() {

		return new Promise( ( resolve, reject) => {

			if (!this._config.virtualZoneConfiguration)
				resolve();

			var keys = Object.keys(this._config.virtualZoneConfiguration);

                  	keys.forEach( (key) => {
				console.log ("Subscribing: paradox_evo/alarm/virtual_zone/" + key + "/set");
                                this._mqttClient.subscribe("paradox_evo/alarm/virtual_zone/" + key + "/set");
                        });
			resolve();
		});

	}

	TranslateCommand(command) {

		if (command.indexOf("G") === 0) {
			this.ProcessSystemEvent(command);
		}
		else if (command.indexOf("PGM") === 0) {
			var pgmNum = +command.substring(3, 5);
			var state = command.substring(5,7) === "ON" ? "ON" : "OFF";

			this.SendMQTTEvent("homeassistant/binary_sensor/paradox_vpgm" + pgmNum  + "/state", state);
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
				this.SendMQTTEvent("homeassistant/binary_sensor/" + nospc + "/config", payload);
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
					this.SendMQTTEvent("homeassistant/binary_sensor/" + nospc + "/state", "ON");
					break;
				case "C":
					this.SendMQTTEvent("homeassistant/binary_sensor/" + nospc + "/state", "OFF");
					break;
			}

			this.ForwardVirtualZoneStatus(zone, status === "O");

		}
		else if (command.indexOf("RA") === 0) {
			//RA001DOOOOOO
			var status = command.substring(5, 6);
		 	var alarmStatus = command.substring(10, 11);
			var area = +command.substring(2, 5);
			var state;
			switch(status) {
				case "D": case "F": case "I":
					state = "disarmed";
					break;
				case "A":
					state = "armed_away";
					break;
				case "S":
					state = "armed_home";
					break;
			}
			if (alarmStatus === "A")
				state = "triggered";

			this.SendMQTTEvent("paradox_evo/alarm/area/" + area, state);
			console.log("Sending default state for area " + area + ": " + state + " to: " + "paradox_evo/alarm/area/" + area);

		}
		else if(command.indexOf("AA") === 0) {
                        var area = +command.substring(2, 5);
			if (command.split("&")[1] === "ok") {
				console.log("Arm OK for Area: " + area);
				this.SendMQTTEvent("paradox_evo/alarm/area/" + area, this._msg);
			}
		}
                else if(command.indexOf("AD") === 0) {
                        var area = +command.substring(2, 5);
			if (command.split("&")[1] === "ok") {
				console.log("Disarm OK for Area: " + area);
                        	this.SendMQTTEvent("paradox_evo/alarm/area/" + area, "disarmed");
			}
                }
		else if(command.indexOf("VC") === 0) {
                        var zone = +command.substring(2, 5);
                        if (command.split("&")[1] === "ok") {
				//this.SendMQTTEvent("paradox_evo/alarm/virtual_zone/" + zone, "CLOSED");
			}
                }
		else if(command.indexOf("VO") === 0) {
                        var zone = +command.substring(2, 5);
                        if (command.split("&")[1] === "ok") {
				//handled by zone update call.
				//this.SendMQTTEvent("paradox_evo/alarm/virtual_zone/" + zone, "OPEN");
			}
                }
		else {
			console.log("Unknown message from panel: " + command);
		}
	}

	ForwardVirtualZoneStatus(panelZone, isOpen) {

		if (!this._config.virtualZoneConfiguration)
			return;

                // If a virtual zone is assigned to this zone, send a mqtt message update for it.
                var keys = Object.keys(this._config.virtualZoneConfiguration); 
                keys.forEach( (key) => {
                        if (panelZone === this._config.virtualZoneConfiguration[key].panelZone) {
                                this.SendMQTTEvent("paradox_evo/alarm/virtual_zone/" + key, isOpen ? "OPEN" : "CLOSED");
                        }
                });
	}



	ProcessSystemEvent(event) {
		//G000N004A001
		var eventGroup = +(event.substring(1, 4));
		var eventNumber = +(event.substring(5, 8));
		var area = +(event.substring(9, 12));
		
		console.log("Received event " + event);

		switch(eventGroup) {
			case 0: // Zone is OK
				var nospc = zoneToHASSLabel[eventNumber];
				this.SendMQTTEvent("homeassistant/binary_sensor/" + nospc + "/state", "OFF");
				this.ForwardVirtualZoneStatus(eventNumber, false);
				break;
			case 1: // Zone is Open
				var nospc = zoneToHASSLabel[eventNumber];
                                this.SendMQTTEvent("homeassistant/binary_sensor/" + nospc + "/state", "ON");
				this.ForwardVirtualZoneStatus(eventNumber, true);
				break;
			case 24: case 25: case 30:
				this.SendMQTTEvent("paradox_evo/alarm/area/" + area, "triggered");
				break;
			case 64:
				switch(eventNumber)
				{ 
					case 2: 
						console.log("PARADOX armed HOME");
						this.SendMQTTEvent("paradox_evo/alarm/area/" + area, "armed_home");
                                		break;
					case 0: case 1: case 3:
						console.log("PARADOX armed AWAY");
                                                this.SendMQTTEvent("paradox_evo/alarm/area/" + area, "armed_away");
                                                break;

				}
		                break;	
			case 13: case 14: case 15: case 16: case 17: case 18: case 19: case 20:
				this.SendMQTTEvent("paradox_evo/alarm/area/" + area, "disarmed");
				break;

		}

	}

	SendMQTTEvent(topic, payload) {
		this._mqttClient.publish(topic, payload, {
			retain: true
		});
	}

	SendCommand(command) {
		this._port.write(command + newLine);
	}

}

//module.exports.ParadoxConnector = ParadoxConnector
