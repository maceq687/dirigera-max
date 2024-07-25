///////////////////////////////////////////
// Made by Maciek Odrowaz
// https://maciekodro.com
// https://github.com/maceq687/dirigera-max
///////////////////////////////////////////
const Max = require("max-api");
const https = require("https");

var globalOptions = {
  host: "",
  port: 8443,
  path: "/v1/devices",
  headers: {
    Authorization: "Bearer ",
  },
  rejectUnauthorized: false,
};

var lightsDict = {};

function parseConfig() {
  var ip;
  var auth_key;
  try {
    const config = require("./dirigera_config.json");
    ip = config.ip;
    auth_key = config.auth_key;
  } catch (error) {
    if (error.code == "MODULE_NOT_FOUND") {
      Max.post("Missing config file");
    } else {
      Max.post(
        "Encountered problem with config file: " + JSON.stringify(error)
      );
    }
  }
  globalOptions.host = ip;
  globalOptions.headers.Authorization =
    globalOptions.headers.Authorization + auth_key;
}

Max.addHandler("dump", async () => {
  var devices = await getDevices();
  for (let i = 0; i < devices.length; i++) {
    Max.post(JSON.stringify(devices[i]));
  }
});

Max.addHandler("listLights", async () => {
  var lights = await getDevices("lights");
  Max.outlet("lightsList clear");
  for (let i = 0; i < lights.length; i++) {
    lightsDict[lights[i].attributes.customName] = lights[i].id;
    Max.outlet("lightsList append " + lights[i].attributes.customName);
  }
});

Max.addHandler("lightCapabilities", async (lightCustomName) => {
  const lightId = lightsDict[lightCustomName];
  if (lightId == undefined) {
    lightIdUndefined(lightCustomName);
  } else {
    const lightCapabilitiesDict = await getDevices(
      "lightCapabilities",
      lightId
    );
    lightCapabilitiesDict["isOn"] = lightCapabilitiesDict["isOn"] ? 1 : 0;
    const keys = Object.getOwnPropertyNames(lightCapabilitiesDict);
    const lightCapabilities = keys.map((key) => [
      key + " " + String(lightCapabilitiesDict[key]),
    ]);
    for (let i = 0; i < lightCapabilities.length; i++) {
      Max.outlet("light " + lightCapabilities[i]);
    }
  }
});

Max.addHandler(
  "lightControl",
  async (lightCustomName, controlParam, value, transitionTime) => {
    if (controlParam === "isOn") {
      value = value === 1;
    }
    const lightId = lightsDict[lightCustomName];
    if (lightId == undefined) {
      lightIdUndefined(lightCustomName);
    } else if (transitionTime) {
      const controlData = JSON.stringify([
        {
          attributes: { [controlParam]: value },
          transitionTime: transitionTime,
        },
      ]);
      await controlDevice(lightId, controlData);
    } else {
      const controlData = JSON.stringify([
        {
          attributes: { [controlParam]: value },
        },
      ]);
      await controlDevice(lightId, controlData);
    }
  }
);

Max.addHandler(
  "lightSetColor",
  async (lightCustomName, hueValue, saturationValue, transitionTime) => {
    const lightId = lightsDict[lightCustomName];
    if (lightId == undefined) {
      lightIdUndefined(lightCustomName);
    } else if (transitionTime) {
      const controlData = JSON.stringify([
        {
          attributes: { colorHue: hueValue, colorSaturation: saturationValue },
          transitionTime: transitionTime,
        },
      ]);
      await controlDevice(lightId, controlData);
    } else {
      const controlData = JSON.stringify([
        {
          attributes: { colorHue: hueValue, colorSaturation: saturationValue },
        },
      ]);
      await controlDevice(lightId, controlData);
    }
  }
);

async function getDevices(type, deviceId) {
  const devices = await httpRequest(globalOptions);
  if (!type) {
    return devices;
  } else if (type === "lights") {
    const lights = devices.filter((device) => device.type === "light");
    return lights;
  } else if (type === "lightCapabilities") {
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
}

async function controlDevice(deviceId, controlData) {
  const controlOptions = {
    ...globalOptions,
    path: globalOptions.path + "/" + deviceId,
    headers: { ...globalOptions.headers, "Content-Type": "application/json" },
    method: "PATCH",
  };
  await httpRequest(controlOptions, controlData);
  return;
}

function httpRequest(requestOptions, requestData) {
  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      if (res.statusCode == 401) {
        Max.post(
          "Unauthorized access error. Make sure that the auth_key is correct"
        );
        return reject(new Error("Unauthorized access"));
      } else if (res.statusCode < 200 || res.statusCode >= 300) {
        Max.post("Error, gateway responded with code " + res.statusCode);
        return reject(new Error("statusCode = " + res.statusCode));
      }
      if (requestData) {
        res.on("end", function () {
          resolve();
        });
      } else {
        var body = [];
        res.on("data", function (chunk) {
          body.push(chunk);
        });
        res.on("end", function () {
          try {
            body = JSON.parse(Buffer.concat(body).toString());
          } catch (e) {
            reject(e);
          }
          resolve(body);
        });
      }
    });
    req.on("error", (error) => {
      if (error.code == "ETIMEDOUT") {
        Max.post(
          "Request timeout. Make sure that the gateway's IP address is correct and gateway is reachable"
        );
      } else if (error.code == "ENOTFOUND") {
        Max.post(
          "Gateway not found. Make sure that the gateway's IP address is correct and gateway is reachable"
        );
      } else {
        Max.post("Request error: " + JSON.stringify(error));
      }
      reject(error);
    });
    if (requestData) {
      req.write(requestData);
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
