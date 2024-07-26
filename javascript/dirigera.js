///////////////////////////////////////////
// Made by Maciek Odrowaz
// https://maciekodro.com
// https://github.com/maceq687/dirigera-max
///////////////////////////////////////////
const Max = require("max-api");
const https = require("https");

const globalOptions = {
  host: "",
  port: 8443,
  path: "/v1/devices",
  headers: {
    Authorization: "Bearer ",
  },
  rejectUnauthorized: false,
};

const lightsDict = {};

function parseConfig() {
  try {
    const config = require("./dirigera_config.json");
    globalOptions.host = config.ip;
    globalOptions.headers.Authorization =
      globalOptions.headers.Authorization + config.auth_key;
  } catch (error) {
    if (error.code == "MODULE_NOT_FOUND") {
      return Max.post("Missing config file");
    }
    Max.post("Encountered problem with config file: " + JSON.stringify(error));
  }
}

Max.addHandler("dump", async () => {
  const devices = await getDevices();
  if (devices == undefined) {
    return Max.post("Encountered error when tried to dump");
  }
  for (let i = 0; i < devices.length; i++) {
    Max.post(JSON.stringify(devices[i]));
  }
});

Max.addHandler("listLights", async () => {
  const lights = await getDevices("lights");
  if (lights == undefined) {
    return Max.post("Encountered error when tried to listLights");
  }
  Max.outlet("lightsList clear");
  lights.forEach((light) => {
    lightsDict[light.attributes.customName] = light.id;
    Max.outlet("lightsList append " + light.attributes.customName);
    if (light.deviceSet.length > 0) {
      lightsDict[light.deviceSet[0].name] = "set/" + light.deviceSet[0].id;
    }
  });
  Max.outlet("lightSetsList clear");
  Object.keys(lightsDict).forEach((key) => {
    const lightId = lightsDict[key];
    if (lightId.startsWith("set/")) {
      Max.outlet("lightSetsList append " + key);
    }
  });
});

Max.addHandler("lightCapabilities", async (lightCustomName) => {
  const lightId = lightsDict[lightCustomName];
  if (lightId == undefined) {
    return lightIdUndefined(lightCustomName);
  }
  if (lightId.startsWith("set/")) {
    return Max.post("Light sets don't have defined capabilities");
  }
  const lightCapabilitiesDict = await getDevices("lightCapabilities", lightId);
  if (lightCapabilitiesDict == undefined) {
    return Max.post("Encountered error when tried to get lightCapabilities");
  }
  lightCapabilitiesDict["isOn"] = lightCapabilitiesDict["isOn"] ? 1 : 0;
  const keys = Object.getOwnPropertyNames(lightCapabilitiesDict);
  const lightCapabilities = keys.map((key) => [
    key + " " + String(lightCapabilitiesDict[key]),
  ]);
  for (let i = 0; i < lightCapabilities.length; i++) {
    Max.outlet("light " + lightCapabilities[i]);
  }
});

Max.addHandler(
  "lightControl",
  (lightCustomName, controlParam, value, transitionTime) => {
    if (controlParam === "isOn") {
      value = value === 1;
    }
    const lightId = lightsDict[lightCustomName];
    if (lightId == undefined) {
      return lightIdUndefined(lightCustomName);
    }
    if (transitionTime) {
      const controlData = JSON.stringify([
        {
          attributes: { [controlParam]: value },
          transitionTime: transitionTime,
        },
      ]);
      return controlDevice(lightId, controlData);
    }
    const controlData = JSON.stringify([
      {
        attributes: { [controlParam]: value },
      },
    ]);
    controlDevice(lightId, controlData);
  }
);

Max.addHandler(
  "lightSetColor",
  (lightCustomName, hueValue, saturationValue, transitionTime) => {
    const lightId = lightsDict[lightCustomName];
    if (lightId == undefined) {
      return lightIdUndefined(lightCustomName);
    }
    if (transitionTime) {
      const controlData = JSON.stringify([
        {
          attributes: { colorHue: hueValue, colorSaturation: saturationValue },
          transitionTime: transitionTime,
        },
      ]);
      return controlDevice(lightId, controlData);
    }
    const controlData = JSON.stringify([
      {
        attributes: { colorHue: hueValue, colorSaturation: saturationValue },
      },
    ]);
    controlDevice(lightId, controlData);
  }
);

async function getDevices(type, deviceId) {
  const devices = await httpRequest(globalOptions);
  if (devices == undefined) {
    return;
  }
  if (type === "lights") {
    const lights = devices.filter((device) => device.type === "light");
    return lights;
  }
  if (type === "lightCapabilities") {
    const light = devices.find((device) => device.id === deviceId);
    var lightCapabilitiesDict = {};
    var capabilitiesToReceive = light.capabilities.canReceive;
    if (capabilitiesToReceive.includes("colorTemperature")) {
      capabilitiesToReceive = [
        ...capabilitiesToReceive,
        "colorTemperatureMax",
        "colorTemperatureMin",
      ];
    }
    for (const cap of capabilitiesToReceive) {
      lightCapabilitiesDict[cap] = light.attributes[cap];
    }
    return lightCapabilitiesDict;
  }
  return devices;
}

function controlDevice(deviceId, controlData) {
  const controlOptions = {
    ...globalOptions,
    path: globalOptions.path + "/" + deviceId,
    headers: { ...globalOptions.headers, "Content-Type": "application/json" },
    method: "PATCH",
  };
  httpRequest(controlOptions, controlData);
}

function httpRequest(requestOptions, controlValue) {
  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      if (res.statusCode == 401) {
        Max.post(
          "Unauthorized access error. Make sure that the auth_key is correct"
        );
        return reject(new Error("Unauthorized access"));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        Max.post("Error, gateway responded with code " + res.statusCode);
        return reject(new Error("statusCode = " + res.statusCode));
      }
      if (controlValue == undefined) {
        var body = [];
        res.on("data", function (chunk) {
          body.push(chunk);
        });
        res.on("end", function () {
          try {
            body = JSON.parse(Buffer.concat(body).toString());
          } catch (error) {
            return reject(new Error(error));
          }
          resolve(body);
        });
      } else {
        res.on("end", function () {
          resolve();
        });
      }
    });
    req.on("error", (error) => {
      if (error.code == "ETIMEDOUT") {
        return Max.post(
          "Request timeout. Make sure that the gateway's IP address is correct and gateway is reachable"
        );
      }
      if (error.code == "ENOTFOUND") {
        return Max.post(
          "Gateway not found. Make sure that the gateway's IP address is correct and gateway is reachable"
        );
      }
      Max.post("Request error: " + JSON.stringify(error));
      return reject(new Error(error));
    });
    if (controlValue) {
      req.write(controlValue);
    }
    req.end();
  });
}

function lightIdUndefined(lightCustomName) {
  Max.post(
    "No light with name: " +
      lightCustomName +
      ", try listLights first and then retry"
  );
}

parseConfig();
