# Dirigera Max

Dirigera Max is a Max MSP package for controlling smart lights connected to the Ikea's Dirigera gateway.

<img src="dirigera.gif" width="600" height="338" />  
<img src="dirigera.gif" width="400" height="400" />  

## How to start

Clone this repository into your Max Packages folder.

Navigate to `<path-to-documents>\Max 8\Packages` on your computer, open command line there and enter:
```
git clone https://github.com/maceq687/dirigera-max
```

## Prerequisities

To make it work you will need to create `dirigera_config.json` file in the javascript folder of the cloned project. The file must contain two variables:

- `ip` - The IP address of the Dirigera gateway.
- `auth_key` - Your access token for the Dirigera gateway. You can obtain this token using e.g. [dirigera](https://github.com/lpgera/dirigera) CLI tool by running `npx dirigera authenticate` and following the instructions.

You will find an example configuration file in the javascript folder, use it as a reference.

### Compatibility

This package was developed and tested on Dirigera gateway art. 105.034.06 and Tradfri smart light bulbs models: LED2109G6 (E27 CWS 806lm) and LED2201G8 (E27 WS 1055lm).

### Notes

It is intended to work only with lights but it is possible to expand it further to control other smart devices that can be connected to the Dirigera gateway.
