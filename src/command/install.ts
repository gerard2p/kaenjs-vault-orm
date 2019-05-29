let pack = require('../package.json');
const {posix:{resolve}} = require('path');
import { existsSync, writeFileSync, readFileSync } from 'fs';

let name = 'vault';
let location = `${pack.name}/command/vault`;

let target = resolve('../../../../kaen.json');
if ( !existsSync(target)) {
    writeFileSync(target, JSON.stringify({commands:{}},null, 2));
}
let configuration = JSON.parse(readFileSync(target, 'utf-8'));
configuration.commands[name] = location;
writeFileSync(target, JSON.stringify(configuration,null, 2));